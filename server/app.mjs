import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile, unlink } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openDatabase, transaction } from './db.mjs';
import { HttpError, fail } from './errors.mjs';
import { CATEGORIES, validateArticle, onlyFields, plain, email, password, fold } from './validation.mjs';
import { readSession, createSession, requireUser, requireAdmin, verifyMutation, hashPassword, checkPassword, publicUser, digest, recordSignIn, LOGIN_HISTORY_LIMIT } from './auth.mjs';
import { inspectImage } from './image.mjs';

const PROJECT = fileURLToPath(new URL('../', import.meta.url));
const ONE_HOUR = 3_600_000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const ARTICLE_COLUMNS = 'id,title,slug,summary,cover_image,cover_alt,category,tags_json,author,blocks_json,references_json,status,featured,published_at,created_at,updated_at';
const safeNumber = (value, fallback, min, max) => { const n = Number(value ?? fallback); if (!Number.isInteger(n) || n < min || n > max) fail(400, 'INVALID_QUERY', 'Tham số phân trang không hợp lệ.'); return n; };
const iso = value => value == null ? null : new Date(value).toISOString();

export function serializeArticle(row, full = true) {
  if (!row) return null;
  const item = { id: row.id, title: row.title, slug: row.slug, summary: row.summary, coverImage: row.cover_image, coverAlt: row.cover_alt, category: row.category, tags: JSON.parse(row.tags_json), author: row.author, status: row.status, featured: Boolean(row.featured), publishedAt: iso(row.published_at), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
  if (full) { item.blocks = JSON.parse(row.blocks_json); item.references = JSON.parse(row.references_json); }
  return item;
}
const commentSelect = `SELECT c.id,c.article_id,c.body,c.status,c.created_at,u.name AS author_name,a.title AS article_title,a.slug AS article_slug FROM comments c JOIN users u ON u.id=c.user_id JOIN articles a ON a.id=c.article_id`;
const serializeComment = row => ({ id: row.id, articleId: row.article_id, articleTitle: row.article_title, articleSlug: row.article_slug, body: row.body, status: row.status, authorName: row.author_name, createdAt: iso(row.created_at) });

async function readBody(req, limit) {
  const claimed = Number(req.headers['content-length'] ?? 0);
  if (claimed > limit) { req.resume(); fail(413, 'BODY_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.'); }
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > limit) fail(413, 'BODY_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) fail(415, 'CONTENT_TYPE', 'Yêu cầu cần dùng Content-Type application/json.');
  const body = await readBody(req, 512 * 1024);
  try { const value = JSON.parse(body.toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { fail(400, 'INVALID_JSON', 'Dữ liệu JSON không hợp lệ.'); }
}
function json(res, status, value) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); }
function ensureFound(row) { if (!row) fail(404, 'NOT_FOUND', 'Không tìm thấy nội dung.'); return row; }

/** Built-in-only HTTP application. No server listens until the caller calls server.listen(). */
export function createApplication(options = {}) {
  const dbPath = options.dbPath ?? join(PROJECT, 'data', 'spofy.sqlite');
  const mediaDir = resolve(options.mediaDir ?? join(PROJECT, 'data', 'media'));
  const distDir = resolve(options.distDir ?? join(PROJECT, 'dist'));
  const parsedOrigin = new URL(options.appOrigin ?? 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.username || parsedOrigin.password || parsedOrigin.pathname !== '/' || parsedOrigin.search || parsedOrigin.hash) throw new Error('APP_ORIGIN phải là origin HTTP(S), không chứa đường dẫn.');
  const appOrigin = parsedOrigin.origin;
  const secureCookies = options.secureCookies ?? parsedOrigin.protocol === 'https:';
  const now = options.now ?? (() => Date.now());
  const limits = { login: { count: 10, windowMs: 15 * 60_000 }, register: { count: 5, windowMs: ONE_HOUR }, comments: { count: 8, windowMs: 10 * 60_000 }, uploads: { count: 100, windowMs: ONE_HOUR }, session: { count: 120, windowMs: 60_000 }, commentIntervalMs: 15_000, ...options.limits };
  const db = openDatabase(dbPath);
  db.function('spofy_fold', { deterministic: true }, value => fold(String(value ?? '')));
  const trackingStartedAt = iso(db.prepare('SELECT applied_at FROM schema_migrations WHERE version=2').get().applied_at);
  const auditMetadata = { trackingStartedAt, historyRetentionLimit: LOGIN_HISTORY_LIMIT };
  let lastPruned = 0;
  function rate(key, config) {
    if (config.count === 0) return;
    const time = now(), previous = db.prepare('SELECT * FROM rate_limits WHERE key=?').get(key);
    if (!previous || previous.window_start + config.windowMs <= time) db.prepare('INSERT INTO rate_limits(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1').run(key, time);
    else if (previous.count >= config.count) fail(429, 'RATE_LIMITED', 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.');
    else db.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').run(key);
  }
  function syncMedia(articleId, article) {
    const urls = [article.coverImage, ...article.blocks.filter(block => block.type === 'image').map(block => block.src)];
    const ids = new Set();
    for (const url of urls) {
      if (!url.startsWith('/media/')) continue;
      const filename = url.slice('/media/'.length);
      const media = db.prepare('SELECT id FROM media WHERE filename=?').get(filename);
      if (!media) fail(422, 'INVALID_MEDIA', 'Ảnh tải lên không tồn tại hoặc đã bị xóa.');
      ids.add(media.id);
    }
    db.prepare('DELETE FROM article_media WHERE article_id=?').run(articleId);
    for (const id of ids) db.prepare('INSERT INTO article_media(article_id,media_id) VALUES(?,?)').run(articleId, id);
  }
  function saveArticle(raw, user, previousRow) {
    const previous = previousRow ? serializeArticle(previousRow) : {};
    const article = validateArticle(raw, previous);
    const duplicate = db.prepare('SELECT id FROM articles WHERE slug=?').get(article.slug);
    if (duplicate && duplicate.id !== previousRow?.id) fail(409, 'SLUG_EXISTS', 'Slug đã được sử dụng. Vui lòng chọn đường dẫn khác.');
    const id = previousRow?.id ?? randomUUID(), time = now();
    const publishedAt = article.status === 'published' ? (previousRow?.published_at ?? time) : (previousRow?.published_at ?? null);
    const searchText = fold([article.title, article.summary, article.author, ...article.tags, ...article.blocks.map(block => block.text ?? block.latex ?? block.caption ?? block.items?.join(' ') ?? '')].join(' '));
    transaction(db, () => {
      if (previousRow) db.prepare('UPDATE articles SET title=?,slug=?,summary=?,cover_image=?,cover_alt=?,category=?,tags_json=?,author=?,blocks_json=?,references_json=?,status=?,featured=?,search_text=?,published_at=?,updated_at=? WHERE id=?').run(article.title, article.slug, article.summary, article.coverImage, article.coverAlt, article.category, JSON.stringify(article.tags), article.author, JSON.stringify(article.blocks), JSON.stringify(article.references), article.status, Number(article.featured), searchText, publishedAt, time, id);
      else db.prepare('INSERT INTO articles(id,title,slug,summary,cover_image,cover_alt,category,tags_json,author,blocks_json,references_json,status,featured,search_text,published_at,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, article.title, article.slug, article.summary, article.coverImage, article.coverAlt, article.category, JSON.stringify(article.tags), article.author, JSON.stringify(article.blocks), JSON.stringify(article.references), article.status, Number(article.featured), searchText, publishedAt, time, time, user.id);
      syncMedia(id, article);
    });
    return serializeArticle(db.prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE id=?`).get(id));
  }

  async function sendFile(req, res, filePath, { privateFile = false, media = false } = {}) {
    let metadata; try { metadata = await stat(filePath); } catch { fail(404, 'NOT_FOUND', 'Không tìm thấy tệp.'); }
    if (!metadata.isFile()) fail(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
    res.statusCode = 200; res.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('Cache-Control', privateFile || media ? 'private, no-store' : (filePath.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'));
    if (media) res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    if (req.method === 'HEAD') return res.end();
    await new Promise((resolveStream, reject) => { const stream = createReadStream(filePath); stream.on('error', reject); res.on('close', () => { stream.destroy(); resolveStream(); }); stream.on('end', resolveStream); stream.pipe(res); });
  }
  async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    if (secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    try {
      const time = now();
      if (time - lastPruned > ONE_HOUR) { db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(time); db.prepare('DELETE FROM rate_limits WHERE window_start<?').run(time - 2 * 24 * ONE_HOUR); lastPruned = time; }
      const url = new URL(req.url, appOrigin);
      let path; try { path = decodeURIComponent(url.pathname); } catch { fail(400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.'); }
      if (path.includes('\0') || path.includes('\\')) fail(400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.');
      const method = req.method ?? 'GET', ip = req.socket.remoteAddress ?? 'unknown';
      let session = readSession(req, db, time);
      if (path.startsWith('/api/admin/')) requireAdmin(session);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && path.startsWith('/api/')) verifyMutation(req, session, appOrigin);
      if (path === '/api/health' && method === 'GET') return json(res, 200, { ok: true });
      if (path === '/api/auth/session' && method === 'GET') {
        if (!session) { rate(`session:${ip}`, limits.session); session = createSession(res, db, { now: time, secureCookies }); }
        return json(res, 200, { user: session.user, csrfToken: session.csrf_token });
      }
      if (path === '/api/auth/register' && method === 'POST') {
        rate(`register:${ip}`, limits.register);
        const body = await readJson(req); onlyFields(body, ['email', 'name', 'password']);
        const normalizedEmail = email(body.email), name = plain(body.name, 'name', 2, 100); password(body.password);
        const hash = await hashPassword(body.password), id = randomUUID();
        try { transaction(db, () => {
          db.prepare("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'reader',?)").run(id, normalizedEmail, name, hash, time);
          session = createSession(res, db, { userId: id, previous: session, now: time, secureCookies });
          recordSignIn(db, id, 'register', time);
        }); }
        catch (error) { if (String(error.message).includes('UNIQUE')) fail(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.'); throw error; }
        return json(res, 201, { user: session.user, csrfToken: session.csrf_token });
      }
      if (path === '/api/auth/login' && method === 'POST') {
        rate(`login:${ip}`, limits.login);
        const body = await readJson(req); onlyFields(body, ['email', 'password']);
        const normalizedEmail = email(body.email); password(body.password);
        const user = db.prepare('SELECT * FROM users WHERE email=?').get(normalizedEmail);
        if (!await checkPassword(body.password, user?.password_hash)) fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
        const loginTime = now();
        transaction(db, () => {
          session = createSession(res, db, { userId: user.id, previous: session, now: loginTime, secureCookies });
          recordSignIn(db, user.id, 'login', loginTime);
        });
        return json(res, 200, { user: session.user, csrfToken: session.csrf_token });
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        const body = await readJson(req); onlyFields(body, []);
        session = createSession(res, db, { previous: session, now: time, secureCookies });
        return json(res, 200, { user: null, csrfToken: session.csrf_token });
      }
      if (path === '/api/categories' && method === 'GET') return json(res, 200, { categories: CATEGORIES });
      if (path === '/api/admin/users' && method === 'GET') {
        requireAdmin(session);
        const page = safeNumber(url.searchParams.get('page'), 1, 1, 100_000), pageSize = safeNumber(url.searchParams.get('pageSize'), 20, 1, 100);
        const query = fold(plain(url.searchParams.get('q') ?? '', 'q', 0, 100));
        const role = url.searchParams.get('role') ?? '';
        if (role && !['reader', 'admin'].includes(role)) fail(400, 'INVALID_ROLE', 'Vai trò lọc không hợp lệ.');
        const where = [], args = [];
        if (query) { where.push('(instr(spofy_fold(u.name),?)>0 OR instr(spofy_fold(u.email),?)>0)'); args.push(query, query); }
        if (role) { where.push('u.role=?'); args.push(role); }
        const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
        const total = db.prepare(`SELECT count(*) AS total FROM users u${clause}`).get(...args).total;
        const items = db.prepare(`SELECT u.id,u.email,u.name,u.role,u.created_at,u.last_login_at,u.login_count,(SELECT count(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>?) AS active_sessions FROM users u${clause} ORDER BY coalesce(u.last_login_at,u.created_at) DESC,u.id DESC LIMIT ? OFFSET ?`).all(time, ...args, pageSize, (page - 1) * pageSize).map(row => ({ ...publicUser(row), createdAt: iso(row.created_at), lastLoginAt: iso(row.last_login_at), loginCount: row.login_count, activeSessions: row.active_sessions }));
        return json(res, 200, { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), ...auditMetadata });
      }
      if (path === '/api/admin/login-events' && method === 'GET') {
        requireAdmin(session);
        const page = safeNumber(url.searchParams.get('page'), 1, 1, 100_000), pageSize = safeNumber(url.searchParams.get('pageSize'), 20, 1, 100);
        const query = fold(plain(url.searchParams.get('q') ?? '', 'q', 0, 100)), args = [];
        let clause = '';
        if (query) { clause = ' WHERE (instr(spofy_fold(u.name),?)>0 OR instr(spofy_fold(u.email),?)>0)'; args.push(query, query); }
        const total = db.prepare(`SELECT count(*) AS total FROM login_events e JOIN users u ON u.id=e.user_id${clause}`).get(...args).total;
        const items = db.prepare(`SELECT e.id,e.user_id,e.occurred_at,e.event_type,u.email,u.name,u.role FROM login_events e JOIN users u ON u.id=e.user_id${clause} ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize).map(row => ({ id: row.id, userId: row.user_id, email: row.email, name: row.name, role: row.role, eventType: row.event_type, occurredAt: iso(row.occurred_at) }));
        return json(res, 200, { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), ...auditMetadata });
      }
      if (path === '/api/articles' && method === 'GET') {
        const page = safeNumber(url.searchParams.get('page'), 1, 1, 100_000), pageSize = safeNumber(url.searchParams.get('pageSize'), 9, 1, 24);
        const query = plain(url.searchParams.get('q') ?? '', 'q', 0, 100), category = url.searchParams.get('category') ?? '';
        if (category && !CATEGORIES.some(item => item.slug === category)) fail(400, 'INVALID_CATEGORY', 'Chuyên mục không hợp lệ.');
        const where = ["status='published'"], args = [];
        if (query) { where.push("search_text LIKE ? ESCAPE '\\'"); args.push(`%${fold(query).replace(/[\\%_]/g, '\\$&')}%`); }
        if (category) { where.push('category=?'); args.push(category); }
        if (['1', 'true'].includes(url.searchParams.get('featured'))) where.push('featured=1');
        const clause = where.join(' AND '), total = db.prepare(`SELECT count(*) AS total FROM articles WHERE ${clause}`).get(...args).total;
        const items = db.prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE ${clause} ORDER BY published_at DESC,id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize).map(row => serializeArticle(row, false));
        return json(res, 200, { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), categories: CATEGORIES });
      }
      let match = path.match(/^\/api\/articles\/([^/]+)\/comments$/);
      if (match) {
        const articleId = match[1]; ensureFound(db.prepare("SELECT id FROM articles WHERE id=? AND status='published'").get(articleId));
        if (method === 'GET') return json(res, 200, { items: db.prepare(`${commentSelect} WHERE c.article_id=? AND c.status='visible' ORDER BY c.created_at ASC,c.id ASC LIMIT 500`).all(articleId).map(serializeComment) });
        if (method === 'POST') {
          const user = requireUser(session), body = await readJson(req); onlyFields(body, ['body']);
          const text = plain(body.body, 'body', 3, 2000), fingerprint = digest(fold(text).replace(/\s+/g, ' '));
          if (db.prepare('SELECT id FROM comments WHERE user_id=? AND article_id=? AND body_fingerprint=? AND created_at>? LIMIT 1').get(user.id, articleId, fingerprint, time - 24 * ONE_HOUR)) fail(409, 'DUPLICATE_COMMENT', 'Bình luận này đã được gửi trong 24 giờ qua.');
          const last = db.prepare('SELECT max(created_at) AS last FROM comments WHERE user_id=?').get(user.id).last;
          if (last != null && time - last < limits.commentIntervalMs) fail(429, 'COMMENT_TOO_FAST', 'Vui lòng chờ ít nhất 15 giây giữa hai bình luận.');
          rate(`comments:user:${user.id}`, limits.comments); rate(`comments:ip:${ip}`, { count: limits.comments.count * 3, windowMs: limits.comments.windowMs });
          const id = randomUUID(); db.prepare("INSERT INTO comments(id,article_id,user_id,body,body_fingerprint,status,created_at) VALUES(?,?,?,?,?,'visible',?)").run(id, articleId, user.id, text, fingerprint, time);
          return json(res, 201, { comment: serializeComment(db.prepare(`${commentSelect} WHERE c.id=?`).get(id)) });
        }
        fail(session?.user?.role === 'admin' ? 405 : 403, 'FORBIDDEN', 'Độc giả không được chỉnh sửa hoặc xóa bình luận.');
      }
      match = path.match(/^\/api\/articles\/([^/]+)$/);
      if (match && method === 'GET') {
        const article = serializeArticle(ensureFound(db.prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE slug=? AND status='published'`).get(match[1])));
        const related = db.prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE status='published' AND category=? AND id<>? ORDER BY published_at DESC LIMIT 3`).all(article.category, article.id).map(row => serializeArticle(row, false));
        return json(res, 200, { article, related });
      }
      if (path === '/api/admin/articles') {
        const user = requireAdmin(session);
        if (method === 'GET') return json(res, 200, { items: db.prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles ORDER BY updated_at DESC`).all().map(row => serializeArticle(row)) });
        if (method === 'POST') return json(res, 201, { article: saveArticle(await readJson(req), user) });
      }
      match = path.match(/^\/api\/admin\/articles\/([^/]+)$/);
      if (match) {
        const user = requireAdmin(session), previous = ensureFound(db.prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles WHERE id=?`).get(match[1]));
        if (method === 'GET') return json(res, 200, { article: serializeArticle(previous) });
        if (method === 'PATCH') return json(res, 200, { article: saveArticle(await readJson(req), user, previous) });
        if (method === 'DELETE') { db.prepare('DELETE FROM articles WHERE id=?').run(previous.id); return json(res, 200, { ok: true }); }
      }
      if (path === '/api/admin/comments' && method === 'GET') {
        requireAdmin(session); return json(res, 200, { items: db.prepare(`${commentSelect} ORDER BY c.created_at DESC LIMIT 1000`).all().map(serializeComment) });
      }
      match = path.match(/^\/api\/admin\/comments\/([^/]+)$/);
      if (match) {
        requireAdmin(session); ensureFound(db.prepare('SELECT id FROM comments WHERE id=?').get(match[1]));
        if (method === 'PATCH') { const body = await readJson(req); onlyFields(body, ['status']); if (!['visible', 'hidden'].includes(body.status)) fail(422, 'VALIDATION', 'Trạng thái bình luận không hợp lệ.'); db.prepare('UPDATE comments SET status=? WHERE id=?').run(body.status, match[1]); return json(res, 200, { comment: serializeComment(db.prepare(`${commentSelect} WHERE c.id=?`).get(match[1])) }); }
        if (method === 'DELETE') { db.prepare('DELETE FROM comments WHERE id=?').run(match[1]); return json(res, 200, { ok: true }); }
      }
      if (path === '/api/admin/uploads' && method === 'POST') {
        const user = requireAdmin(session); rate(`uploads:${user.id}`, limits.uploads);
        const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        const buffer = await readBody(req, 5 * 1024 * 1024), inspected = inspectImage(buffer, mime), id = randomUUID(), filename = `${id}.${inspected.extension}`;
        await mkdir(mediaDir, { recursive: true, mode: 0o700 });
        const filePath = join(mediaDir, filename); await writeFile(filePath, buffer, { flag: 'wx', mode: 0o600 });
        try { db.prepare('INSERT INTO media(id,filename,mime,size,width,height,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id, filename, inspected.mime, buffer.length, inspected.width, inspected.height, user.id, time); }
        catch (error) { await unlink(filePath); throw error; }
        return json(res, 201, { image: { id, src: `/media/${filename}`, width: inspected.width, height: inspected.height, mime: inspected.mime, size: buffer.length } });
      }
      if (path.startsWith('/api/')) fail(404, 'NOT_FOUND', 'API không tồn tại hoặc không hỗ trợ thao tác này.');
      match = path.match(/^\/media\/([a-f0-9-]{36}\.(?:png|jpg))$/);
      if (match && ['GET', 'HEAD'].includes(method)) {
        const media = ensureFound(db.prepare('SELECT * FROM media WHERE filename=?').get(match[1]));
        const published = db.prepare("SELECT 1 FROM article_media am JOIN articles a ON a.id=am.article_id WHERE am.media_id=? AND a.status='published' LIMIT 1").get(media.id);
        if (!published && session?.user?.role !== 'admin') fail(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
        return await sendFile(req, res, join(mediaDir, media.filename), { privateFile: true, media: true });
      }
      if (path.startsWith('/media/')) fail(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
      if (!['GET', 'HEAD'].includes(method)) fail(405, 'METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.');
      // The server never exposes source, configuration, SQLite files, backups or arbitrary paths.
      const spa = path === '/' || /^\/(?:khoa-hoc(?:\/[a-z0-9-]+)?|dang-nhap|dang-ky|admin(?:\/.*)?)\/?$/.test(path);
      const relative = spa ? 'index.html' : path.replace(/^\/+/, '');
      if (!spa && (relative.split('/').some(part => !part || part.startsWith('.') || part === '..') || !/^(?:assets\/[^/]+|fonts\/[^/]+|hero\/[^/]+|images\/[^/]+|landing-pages\/inner-green-assets\/lexend-latin\.woff2|archive\/(?:photos|thumbs)\/\d+\.webp|[^/]+\.(?:json|svg|png|webp|ico|jpg|jpeg|woff2))$/.test(relative))) fail(404, 'NOT_FOUND', 'Không tìm thấy nội dung.');
      const target = resolve(distDir, relative);
      if (!target.startsWith(distDir + sep)) fail(404, 'NOT_FOUND', 'Không tìm thấy nội dung.');
      return await sendFile(req, res, target, { privateFile: spa });
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      const known = error instanceof HttpError;
      if (!known) (options.logger ?? console).error('SPOFY server error:', error);
      if (known && error.status === 429) res.setHeader('Retry-After', '60');
      return json(res, known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Máy chủ gặp lỗi. Vui lòng thử lại sau.', ...(known && error.fields ? { fields: error.fields } : {}) } });
    }
  }
  const server = createServer(handler);
  server.requestTimeout = 20_000; server.headersTimeout = 15_000; server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 60;
  let closed = false;
  return { server, db, appOrigin, async close() { if (closed) return; closed = true; await new Promise(resolveClose => { server.close(() => resolveClose()); server.closeIdleConnections(); }); db.close(); } };
}
