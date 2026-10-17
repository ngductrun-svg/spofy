import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpError, fail } from '../../server/errors.mjs';
import { CATEGORIES, validateArticle, onlyFields, plain, email, password, fold } from '../../server/validation.mjs';
import { hashPassword, checkPassword, digest, publicUser, LOGIN_HISTORY_LIMIT } from '../../server/auth.mjs';
import { inspectImage } from '../../server/image.mjs';

const HOUR = 3_600_000;
const COOKIE = 'spofy_session';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ARTICLE_COLUMNS = 'id,title,slug,summary,cover_image,cover_alt,category,tags_json,author,blocks_json,references_json,status,featured,published_at,created_at,updated_at';
const COMMENT_SELECT = 'SELECT c.id,c.article_id,c.body,c.status,c.created_at,u.name AS author_name,a.title AS article_title,a.slug AS article_slug FROM comments c JOIN users u ON u.id=c.user_id JOIN articles a ON a.id=c.article_id';
const iso = value => value == null ? null : new Date(Number(value)).toISOString();
const parsedJson = value => typeof value === 'string' ? JSON.parse(value) : value;
const safeNumber = (value, fallback, min, max) => {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) fail(400, 'INVALID_QUERY', 'Tham số phân trang không hợp lệ.');
  return number;
};
const ensureFound = row => { if (!row) fail(404, 'NOT_FOUND', 'Không tìm thấy nội dung.'); return row; };
const first = async (database, sql, parameters = []) => (await database.query(sql, parameters)).rows[0];
const list = async (database, sql, parameters = []) => (await database.query(sql, parameters)).rows;

function serializeArticle(row, full = true) {
  if (!row) return null;
  const result = { id: row.id, title: row.title, slug: row.slug, summary: row.summary, coverImage: row.cover_image, coverAlt: row.cover_alt, category: row.category, tags: parsedJson(row.tags_json), author: row.author, status: row.status, featured: Boolean(row.featured), publishedAt: iso(row.published_at), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
  if (full) { result.blocks = parsedJson(row.blocks_json); result.references = parsedJson(row.references_json); }
  return result;
}
const serializeComment = row => ({ id: row.id, articleId: row.article_id, articleTitle: row.article_title, articleSlug: row.article_slug, body: row.body, status: row.status, authorName: row.author_name, createdAt: iso(row.created_at) });

async function readBody(request, limit) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > limit) fail(413, 'BODY_TOO_LARGE', `Dữ liệu gửi lên quá lớn${limit === MAX_IMAGE_BYTES ? ' (ảnh tối đa 4 MiB)' : ''}.`);
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); fail(413, 'BODY_TOO_LARGE', `Dữ liệu gửi lên quá lớn${limit === MAX_IMAGE_BYTES ? ' (ảnh tối đa 4 MiB)' : ''}.`); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) fail(415, 'CONTENT_TYPE', 'Yêu cầu cần dùng Content-Type application/json.');
  const bytes = await readBody(request, 512 * 1024);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(400, 'INVALID_JSON', 'Dữ liệu JSON không hợp lệ.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'INVALID_JSON', 'Dữ liệu JSON không hợp lệ.');
  return value;
}
function requireUser(session) { if (!session?.user) fail(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục.'); return session.user; }
function requireAdmin(session) { const user = requireUser(session); if (user.role !== 'admin') fail(403, 'FORBIDDEN', 'Thao tác này chỉ dành cho admin.'); return user; }
function verifyMutation(request, session, appOrigin) {
  if (request.headers.get('origin') !== appOrigin || request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'ORIGIN_REJECTED', 'Nguồn yêu cầu không hợp lệ.');
  const csrf = request.headers.get('x-csrf-token');
  if (!session || !/^[a-f0-9]{64}$/.test(csrf ?? '') || !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf_token))) fail(403, 'CSRF_REJECTED', 'Phiên bảo vệ đã thay đổi. Vui lòng tải lại trang và thử lại.');
}

/** Fetch handler for Netlify Functions. Persistence is provided by Postgres and
 * a private Blob store; this module never starts a server or writes local files. */
export function createCloudHandler({ db, storage, env = {}, now = Date.now }) {
  if (!db?.query || !db?.transaction || !storage?.put || !storage?.get || !storage?.delete) throw new Error('Cloud handler requires database and storage adapters.');
  const limits = { login: { count: 10, windowMs: 15 * 60_000 }, register: { count: 5, windowMs: HOUR }, comments: { count: 8, windowMs: 10 * 60_000 }, uploads: { count: 100, windowMs: HOUR }, session: { count: 120, windowMs: 60_000 } };
  let lastPruned = 0;

  async function rate(database, key, config, time) {
    const row = await first(database, `INSERT INTO rate_limits(key,window_start,count) VALUES($1,$2,1)
      ON CONFLICT(key) DO UPDATE SET
      window_start=CASE WHEN rate_limits.window_start+$3<=$2 THEN $2 ELSE rate_limits.window_start END,
      count=CASE WHEN rate_limits.window_start+$3<=$2 THEN 1 ELSE rate_limits.count+1 END RETURNING count`, [key, time, config.windowMs]);
    if (Number(row.count) > config.count) fail(429, 'RATE_LIMITED', 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.');
  }
  async function readSession(request, time) {
    const token = String(request.headers.get('cookie') ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!/^[a-f0-9]{64}$/.test(token ?? '')) return null;
    const session = await first(db, 'SELECT * FROM sessions WHERE token_hash=$1 AND expires_at>$2', [digest(token), time]);
    if (!session) return null;
    const user = session.user_id ? await first(db, 'SELECT id,email,name,role FROM users WHERE id=$1', [session.user_id]) : null;
    if (session.user_id && !user) return null;
    return { ...session, user: publicUser(user) };
  }
  async function rotateSession(database, previous, time, userId = null) {
    if (previous) await database.query('DELETE FROM sessions WHERE token_hash=$1', [previous.token_hash]);
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    const maxAge = userId ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    const session = { token_hash: digest(token), csrf_token: csrf, user_id: userId, expires_at: time + maxAge * 1000, created_at: time };
    await database.query('INSERT INTO sessions(token_hash,csrf_token,user_id,expires_at,created_at) VALUES($1,$2,$3,$4,$5)', [session.token_hash, csrf, userId, session.expires_at, time]);
    session.user = userId ? publicUser(await first(database, 'SELECT id,email,name,role FROM users WHERE id=$1', [userId])) : null;
    return { session, cookie: `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure` };
  }
  async function recordSignIn(database, userId, eventType, time) {
    await database.query('UPDATE users SET last_login_at=$1,login_count=login_count+1 WHERE id=$2', [time, userId]);
    // Serialize retention across concurrent sign-ins without persisting IP/UA.
    await database.query('SELECT version FROM schema_migrations WHERE version=2 FOR UPDATE');
    await database.query('INSERT INTO login_events(id,user_id,occurred_at,event_type) VALUES($1,$2,$3,$4)', [randomUUID(), userId, time, eventType]);
    await database.query('DELETE FROM login_events WHERE id IN (SELECT id FROM login_events ORDER BY occurred_at DESC,id DESC OFFSET $1)', [LOGIN_HISTORY_LIMIT]);
  }
  async function auditMetadata() {
    const migration = await first(db, 'SELECT applied_at FROM schema_migrations WHERE version=2');
    return { trackingStartedAt: iso(migration?.applied_at), historyRetentionLimit: LOGIN_HISTORY_LIMIT };
  }
  async function syncMedia(database, articleId, article) {
    const urls = [article.coverImage, ...article.blocks.filter(block => block.type === 'image').map(block => block.src)], ids = new Set();
    for (const url of urls) {
      if (!url.startsWith('/media/')) continue;
      const media = await first(database, 'SELECT id FROM media WHERE filename=$1', [url.slice('/media/'.length)]);
      if (!media) fail(422, 'INVALID_MEDIA', 'Ảnh tải lên không tồn tại hoặc đã bị xóa.');
      ids.add(media.id);
    }
    await database.query('DELETE FROM article_media WHERE article_id=$1', [articleId]);
    for (const id of ids) await database.query('INSERT INTO article_media(article_id,media_id) VALUES($1,$2)', [articleId, id]);
  }
  async function saveArticle(raw, user, previousId = null) {
    try {
      return await db.transaction(async database => {
        const previousRow = previousId ? ensureFound(await first(database, `SELECT ${ARTICLE_COLUMNS} FROM articles WHERE id=$1 FOR UPDATE`, [previousId])) : null;
        const article = validateArticle(raw, previousRow ? serializeArticle(previousRow) : {});
        const duplicate = await first(database, 'SELECT id FROM articles WHERE slug=$1', [article.slug]);
        if (duplicate && duplicate.id !== previousId) fail(409, 'SLUG_EXISTS', 'Slug đã được sử dụng. Vui lòng chọn đường dẫn khác.');
        const id = previousId ?? randomUUID(), time = now(), publishedAt = article.status === 'published' ? (previousRow?.published_at ?? time) : (previousRow?.published_at ?? null);
        const search = fold([article.title, article.summary, article.author, ...article.tags, ...article.blocks.map(block => block.text ?? block.latex ?? block.caption ?? block.items?.join(' ') ?? '')].join(' '));
        const values = [article.title, article.slug, article.summary, article.coverImage, article.coverAlt, article.category, JSON.stringify(article.tags), article.author, JSON.stringify(article.blocks), JSON.stringify(article.references), article.status, Number(article.featured), search, publishedAt, time];
        if (previousId) await database.query('UPDATE articles SET title=$1,slug=$2,summary=$3,cover_image=$4,cover_alt=$5,category=$6,tags_json=$7,author=$8,blocks_json=$9,references_json=$10,status=$11,featured=$12,search_text=$13,published_at=$14,updated_at=$15 WHERE id=$16', [...values, id]);
        else await database.query('INSERT INTO articles(title,slug,summary,cover_image,cover_alt,category,tags_json,author,blocks_json,references_json,status,featured,search_text,published_at,created_at,updated_at,id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,$16,$17)', [...values, id, user.id]);
        await syncMedia(database, id, article);
        return serializeArticle(await first(database, `SELECT ${ARTICLE_COLUMNS} FROM articles WHERE id=$1`, [id]));
      });
    } catch (error) { if (error.code === '23505') fail(409, 'SLUG_EXISTS', 'Slug đã được sử dụng. Vui lòng chọn đường dẫn khác.'); throw error; }
  }

  return async function handle(request) {
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
    const json = (status, value) => { headers.set('Content-Type', 'application/json; charset=utf-8'); return new Response(JSON.stringify(value), { status, headers }); };
    try {
      const url = new URL(request.url), time = now();
      const origin = env.APP_ORIGIN ? new URL(env.APP_ORIGIN) : url;
      if (!['http:', 'https:'].includes(url.protocol) || origin.origin !== url.origin || (env.APP_ORIGIN && (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password))) fail(403, 'ORIGIN_REJECTED', 'Địa chỉ website không khớp cấu hình máy chủ.');
      if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      let path; try { path = decodeURIComponent(url.pathname); } catch { fail(400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.'); }
      path = path.replace(/^\/\.netlify\/functions\/spofy(?=\/|$)/, '') || '/';
      if (path.includes('\0') || path.includes('\\')) fail(400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.');
      const method = request.method.toUpperCase();
      // Netlify supplies this platform header. Never trust arbitrary X-Forwarded-For.
      const ip = digest(request.headers.get('x-nf-client-connection-ip') || 'shared');
      let session = await readSession(request, time);
      if (path.startsWith('/api/admin/')) requireAdmin(session);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && path.startsWith('/api/')) verifyMutation(request, session, origin.origin);
      if (time - lastPruned > HOUR) {
        await db.query('DELETE FROM sessions WHERE expires_at<=$1', [time]);
        await db.query('DELETE FROM rate_limits WHERE window_start<$1', [time - 2 * 24 * HOUR]);
        lastPruned = time;
      }
      if (path === '/api/health' && method === 'GET') return json(200, { ok: true, storage: 'postgres-blobs' });
      if (path === '/api/auth/session' && method === 'GET') {
        if (!session) {
          await rate(db, `session:${ip}`, limits.session, time);
          const rotated = await db.transaction(database => rotateSession(database, null, time));
          session = rotated.session; headers.set('Set-Cookie', rotated.cookie);
        }
        return json(200, { user: session.user, csrfToken: session.csrf_token });
      }
      if (path === '/api/auth/register' && method === 'POST') {
        await rate(db, `register:${ip}`, limits.register, time);
        const body = await readJson(request); onlyFields(body, ['email', 'name', 'password']);
        const normalizedEmail = email(body.email), name = plain(body.name, 'name', 2, 100); password(body.password);
        const hash = await hashPassword(body.password), id = randomUUID();
        let rotated;
        try {
          rotated = await db.transaction(async database => {
            await database.query("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES($1,$2,$3,$4,'reader',$5)", [id, normalizedEmail, name, hash, time]);
            const created = await rotateSession(database, session, time, id);
            await recordSignIn(database, id, 'register', time);
            return created;
          });
        } catch (error) { if (error.code === '23505') fail(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.'); throw error; }
        headers.set('Set-Cookie', rotated.cookie);
        return json(201, { user: rotated.session.user, csrfToken: rotated.session.csrf_token });
      }
      if (path === '/api/auth/login' && method === 'POST') {
        await rate(db, `login:${ip}`, limits.login, time);
        const body = await readJson(request); onlyFields(body, ['email', 'password']);
        const normalizedEmail = email(body.email); password(body.password);
        await rate(db, `login:email:${digest(normalizedEmail)}`, limits.login, time);
        const user = await first(db, 'SELECT * FROM users WHERE email=$1', [normalizedEmail]);
        if (!await checkPassword(body.password, user?.password_hash)) fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
        const loginTime = now();
        const rotated = await db.transaction(async database => {
          const created = await rotateSession(database, session, loginTime, user.id);
          await recordSignIn(database, user.id, 'login', loginTime);
          return created;
        });
        headers.set('Set-Cookie', rotated.cookie);
        return json(200, { user: rotated.session.user, csrfToken: rotated.session.csrf_token });
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        const body = await readJson(request); onlyFields(body, []);
        const rotated = await db.transaction(database => rotateSession(database, session, time));
        headers.set('Set-Cookie', rotated.cookie);
        return json(200, { user: null, csrfToken: rotated.session.csrf_token });
      }
      if (path === '/api/categories' && method === 'GET') return json(200, { categories: CATEGORIES });
      if (path === '/api/admin/users' && method === 'GET') {
        requireAdmin(session);
        const page = safeNumber(url.searchParams.get('page'), 1, 1, 100_000), pageSize = safeNumber(url.searchParams.get('pageSize'), 20, 1, 100);
        const query = fold(plain(url.searchParams.get('q') ?? '', 'q', 0, 100)), role = url.searchParams.get('role') ?? '';
        if (role && !['reader', 'admin'].includes(role)) fail(400, 'INVALID_ROLE', 'Vai trò lọc không hợp lệ.');
        const where = [], args = [];
        if (query) { args.push(query); where.push(`strpos(spofy_fold(u.name||' '||u.email),$${args.length})>0`); }
        if (role) { args.push(role); where.push(`u.role=$${args.length}`); }
        const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
        const total = Number((await first(db, `SELECT count(*) AS total FROM users u${clause}`, args)).total);
        const currentIndex = args.length + 1;
        const items = (await list(db, `SELECT u.id,u.email,u.name,u.role,u.created_at,u.last_login_at,u.login_count,(SELECT count(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>$${currentIndex}) AS active_sessions FROM users u${clause} ORDER BY coalesce(u.last_login_at,u.created_at) DESC,u.id DESC LIMIT $${currentIndex + 1} OFFSET $${currentIndex + 2}`, [...args, time, pageSize, (page - 1) * pageSize])).map(row => ({ ...publicUser(row), createdAt: iso(row.created_at), lastLoginAt: iso(row.last_login_at), loginCount: Number(row.login_count), activeSessions: Number(row.active_sessions) }));
        return json(200, { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), ...await auditMetadata() });
      }
      if (path === '/api/admin/login-events' && method === 'GET') {
        requireAdmin(session);
        const page = safeNumber(url.searchParams.get('page'), 1, 1, 100_000), pageSize = safeNumber(url.searchParams.get('pageSize'), 20, 1, 100);
        const query = fold(plain(url.searchParams.get('q') ?? '', 'q', 0, 100)), args = query ? [query] : [], clause = query ? " WHERE strpos(spofy_fold(u.name||' '||u.email),$1)>0" : '';
        const total = Number((await first(db, `SELECT count(*) AS total FROM login_events e JOIN users u ON u.id=e.user_id${clause}`, args)).total);
        const items = (await list(db, `SELECT e.id,e.user_id,e.occurred_at,e.event_type,u.email,u.name,u.role FROM login_events e JOIN users u ON u.id=e.user_id${clause} ORDER BY e.occurred_at DESC,e.id DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, [...args, pageSize, (page - 1) * pageSize])).map(row => ({ id: row.id, userId: row.user_id, email: row.email, name: row.name, role: row.role, eventType: row.event_type, occurredAt: iso(row.occurred_at) }));
        return json(200, { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), ...await auditMetadata() });
      }
      if (path === '/api/articles' && method === 'GET') {
        const page = safeNumber(url.searchParams.get('page'), 1, 1, 100_000), pageSize = safeNumber(url.searchParams.get('pageSize'), 9, 1, 24);
        const query = plain(url.searchParams.get('q') ?? '', 'q', 0, 100), category = url.searchParams.get('category') ?? '';
        if (category && !CATEGORIES.some(item => item.slug === category)) fail(400, 'INVALID_CATEGORY', 'Chuyên mục không hợp lệ.');
        const where = ["status='published'"], args = [];
        if (query) { args.push(fold(query)); where.push(`strpos(search_text,$${args.length})>0`); }
        if (category) { args.push(category); where.push(`category=$${args.length}`); }
        if (['1', 'true'].includes(url.searchParams.get('featured'))) where.push('featured=1');
        const clause = where.join(' AND '), total = Number((await first(db, `SELECT count(*) AS total FROM articles WHERE ${clause}`, args)).total);
        const items = (await list(db, `SELECT ${ARTICLE_COLUMNS} FROM articles WHERE ${clause} ORDER BY published_at DESC,id DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, [...args, pageSize, (page - 1) * pageSize])).map(row => serializeArticle(row, false));
        return json(200, { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), categories: CATEGORIES });
      }
      let match = path.match(/^\/api\/articles\/([^/]+)\/comments$/);
      if (match) {
        const articleId = match[1]; ensureFound(await first(db, "SELECT id FROM articles WHERE id=$1 AND status='published'", [articleId]));
        if (method === 'GET') return json(200, { items: (await list(db, `${COMMENT_SELECT} WHERE c.article_id=$1 AND c.status='visible' ORDER BY c.created_at ASC,c.id ASC LIMIT 500`, [articleId])).map(serializeComment) });
        if (method === 'POST') {
          const user = requireUser(session), body = await readJson(request); onlyFields(body, ['body']);
          const text = plain(body.body, 'body', 3, 2000), fingerprint = digest(fold(text).replace(/\s+/g, ' ')), id = randomUUID();
          const comment = await db.transaction(async database => {
            // A stable user lock closes duplicate/interval races across instances.
            await database.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
            ensureFound(await first(database, "SELECT id FROM articles WHERE id=$1 AND status='published' FOR SHARE", [articleId]));
            if (await first(database, 'SELECT id FROM comments WHERE user_id=$1 AND article_id=$2 AND body_fingerprint=$3 AND created_at>$4 LIMIT 1', [user.id, articleId, fingerprint, time - 24 * HOUR])) fail(409, 'DUPLICATE_COMMENT', 'Bình luận này đã được gửi trong 24 giờ qua.');
            const last = (await first(database, 'SELECT max(created_at) AS last FROM comments WHERE user_id=$1', [user.id])).last;
            if (last != null && time - Number(last) < 15_000) fail(429, 'COMMENT_TOO_FAST', 'Vui lòng chờ ít nhất 15 giây giữa hai bình luận.');
            await rate(database, `comments:user:${user.id}`, limits.comments, time);
            await rate(database, `comments:ip:${ip}`, { count: limits.comments.count * 3, windowMs: limits.comments.windowMs }, time);
            await database.query("INSERT INTO comments(id,article_id,user_id,body,body_fingerprint,status,created_at) VALUES($1,$2,$3,$4,$5,'visible',$6)", [id, articleId, user.id, text, fingerprint, time]);
            return serializeComment(await first(database, `${COMMENT_SELECT} WHERE c.id=$1`, [id]));
          });
          return json(201, { comment });
        }
        fail(session?.user?.role === 'admin' ? 405 : 403, 'FORBIDDEN', 'Độc giả không được chỉnh sửa hoặc xóa bình luận.');
      }
      match = path.match(/^\/api\/articles\/([^/]+)$/);
      if (match && method === 'GET') {
        const article = serializeArticle(ensureFound(await first(db, `SELECT ${ARTICLE_COLUMNS} FROM articles WHERE slug=$1 AND status='published'`, [match[1]])));
        const related = (await list(db, `SELECT ${ARTICLE_COLUMNS} FROM articles WHERE status='published' AND category=$1 AND id<>$2 ORDER BY published_at DESC LIMIT 3`, [article.category, article.id])).map(row => serializeArticle(row, false));
        return json(200, { article, related });
      }
      if (path === '/api/admin/articles') {
        const user = requireAdmin(session);
        if (method === 'GET') return json(200, { items: (await list(db, `SELECT ${ARTICLE_COLUMNS} FROM articles ORDER BY updated_at DESC`)).map(row => serializeArticle(row)) });
        if (method === 'POST') return json(201, { article: await saveArticle(await readJson(request), user) });
      }
      match = path.match(/^\/api\/admin\/articles\/([^/]+)$/);
      if (match) {
        const user = requireAdmin(session), previous = ensureFound(await first(db, `SELECT ${ARTICLE_COLUMNS} FROM articles WHERE id=$1`, [match[1]]));
        if (method === 'GET') return json(200, { article: serializeArticle(previous) });
        if (method === 'PATCH') return json(200, { article: await saveArticle(await readJson(request), user, previous.id) });
        if (method === 'DELETE') { await db.query('DELETE FROM articles WHERE id=$1', [previous.id]); return json(200, { ok: true }); }
      }
      if (path === '/api/admin/comments' && method === 'GET') {
        requireAdmin(session); return json(200, { items: (await list(db, `${COMMENT_SELECT} ORDER BY c.created_at DESC LIMIT 1000`)).map(serializeComment) });
      }
      match = path.match(/^\/api\/admin\/comments\/([^/]+)$/);
      if (match) {
        requireAdmin(session); ensureFound(await first(db, 'SELECT id FROM comments WHERE id=$1', [match[1]]));
        if (method === 'PATCH') {
          const body = await readJson(request); onlyFields(body, ['status']);
          if (!['visible', 'hidden'].includes(body.status)) fail(422, 'VALIDATION', 'Trạng thái bình luận không hợp lệ.');
          await db.query('UPDATE comments SET status=$1 WHERE id=$2', [body.status, match[1]]);
          return json(200, { comment: serializeComment(await first(db, `${COMMENT_SELECT} WHERE c.id=$1`, [match[1]])) });
        }
        if (method === 'DELETE') { await db.query('DELETE FROM comments WHERE id=$1', [match[1]]); return json(200, { ok: true }); }
      }
      if (path === '/api/admin/uploads' && method === 'POST') {
        const user = requireAdmin(session); await rate(db, `uploads:${user.id}`, limits.uploads, time);
        const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
        if (!['image/png', 'image/jpeg'].includes(mime)) fail(415, 'IMAGE_TYPE', 'Chỉ chấp nhận tệp PNG hoặc JPEG thực sự, tối đa 4 MiB.');
        const bytes = await readBody(request, MAX_IMAGE_BYTES), inspected = inspectImage(bytes, mime), id = randomUUID(), filename = `${id}.${inspected.extension}`;
        await storage.put(filename, bytes, { mime: inspected.mime, width: inspected.width, height: inspected.height });
        try { await db.query('INSERT INTO media(id,filename,mime,size,width,height,uploaded_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, filename, inspected.mime, bytes.length, inspected.width, inspected.height, user.id, time]); }
        catch (error) { try { await storage.delete(filename); } catch {} throw error; }
        return json(201, { image: { id, src: `/media/${filename}`, width: inspected.width, height: inspected.height, mime: inspected.mime, size: bytes.length } });
      }
      match = path.match(/^\/media\/([a-f0-9-]{36}\.(?:png|jpg))$/);
      if (match && ['GET', 'HEAD'].includes(method)) {
        const media = ensureFound(await first(db, 'SELECT * FROM media WHERE filename=$1', [match[1]]));
        const published = await first(db, "SELECT 1 FROM article_media am JOIN articles a ON a.id=am.article_id WHERE am.media_id=$1 AND a.status='published' LIMIT 1", [media.id]);
        if (!published && session?.user?.role !== 'admin') fail(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
        const blob = ensureFound(await storage.get(media.filename));
        headers.set('Content-Type', media.mime); headers.set('Content-Length', String(blob.data.byteLength));
        headers.set('Cache-Control', 'private, no-store'); headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
        return new Response(method === 'HEAD' ? null : blob.data, { status: 200, headers });
      }
      fail(404, 'NOT_FOUND', path.startsWith('/media/') ? 'Không tìm thấy tệp.' : 'API không tồn tại hoặc không hỗ trợ thao tác này.');
    } catch (error) {
      const known = error instanceof HttpError;
      if (!known) console.error('SPOFY cloud request failed:', { code: error?.code ?? 'INTERNAL_ERROR', name: error?.name ?? 'Error' });
      if (known && error.status === 429) headers.set('Retry-After', '60');
      return json(known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Máy chủ gặp lỗi. Vui lòng thử lại sau.', ...(known && error.fields ? { fields: error.fields } : {}) } });
    }
  };
}
