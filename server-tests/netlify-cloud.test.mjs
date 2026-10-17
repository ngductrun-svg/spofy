import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createCloudHandler } from '../netlify/server/app.mjs';
import { normalizeResult } from '../netlify/server/database.mjs';
import { hashPassword, digest } from '../server/auth.mjs';
import { ADMIN, READER, PNG, articleFixture } from './helpers.mjs';

// These tests execute the production Fetch handler and real PostgreSQL SQL in
// PGlite. Only the Netlify Blob transport is replaced by an isolated Map store.
// No test account, article, key or media file reaches the production database.
const ORIGIN = 'https://spofy-cloud.example.test';
const migration = await readFile(new URL('../netlify/database/migrations/0001_initial.sql', import.meta.url), 'utf8');

async function fixture({ persistent = false } = {}) {
  let engine = new PGlite();
  let clock = Date.now(), handler, nextIp = 1;
  const media = new Map();
  const storage = {
    async put(filename, data, metadata) { media.set(filename, { data: Uint8Array.from(data), metadata: { ...metadata } }); },
    async get(filename) { return media.get(filename) ?? null; },
    async delete(filename) { media.delete(filename); },
  };
  const scoped = connection => ({ query: async (sql, params = []) => {
    const result = await connection.query(sql, params);
    return normalizeResult({ ...result, rowCount: result.affectedRows ?? result.rows.length });
  } });
  const db = {
    query: (sql, params = []) => scoped(engine).query(sql, params),
    transaction: work => engine.transaction(connection => work(scoped(connection))),
  };
  const start = () => { handler = createCloudHandler({ db, storage, env: { APP_ORIGIN: ORIGIN }, now: () => clock }); };
  try {
    await engine.exec(migration);
    const hash = await hashPassword(ADMIN.password);
    await db.query("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES($1,$2,$3,$4,'admin',$5)", [randomUUID(), ADMIN.email, ADMIN.name, hash, clock]);
    start();
  } catch (error) { await engine.close(); throw error; }
  const result = {
    db, media, storage,
    get now() { return clock; },
    get handle() { return handler; },
    advance(milliseconds) { clock += milliseconds; },
    resetHandler: start,
    client() { return new CloudClient(result, `203.0.113.${nextIp++}`); },
    async restartDatabase() {
      assert.ok(persistent, 'database restoration is explicitly enabled for this fixture');
      // PGlite's native filesystem aborts on some Windows runtimes. A PGDATA
      // snapshot restores the same real PostgreSQL tables into a new engine,
      // independently of this test host's filesystem support.
      const snapshot = await engine.dumpDataDir();
      await engine.close();
      engine = new PGlite({ loadDataDir: snapshot });
      await engine.exec(migration);
      start();
    },
    async close() { await engine.close(); },
  };
  return result;
}
class CloudClient {
  constructor(owner, ip) { this.owner = owner; this.ip = ip; this.cookie = ''; this.csrf = ''; }
  async request(path, { method = 'GET', data, body, origin = ORIGIN, csrf = true, headers: supplied = {} } = {}) {
    const headers = new Headers(supplied);
    headers.set('x-nf-client-connection-ip', this.ip);
    if (this.cookie) headers.set('Cookie', this.cookie);
    if (origin) headers.set('Origin', origin);
    if (csrf && this.csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CSRF-Token', this.csrf);
    if (data !== undefined) headers.set('Content-Type', 'application/json');
    const response = await this.owner.handle(new Request(ORIGIN + path, { method, headers, ...(data !== undefined ? { body: JSON.stringify(data) } : body !== undefined ? { body } : {}) }));
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const bytes = Buffer.from(await response.arrayBuffer()), text = bytes.toString('utf8');
    let json = null;
    if (response.headers.get('content-type')?.startsWith('application/json')) json = JSON.parse(text);
    if (json?.csrfToken) this.csrf = json.csrfToken;
    return { status: response.status, headers: response.headers, json, text, bytes };
  }
  async session() {
    const result = await this.request('/api/auth/session');
    assert.equal(result.status, 200, result.text);
    return result;
  }
  async login(account = ADMIN) {
    await this.session();
    const result = await this.request('/api/auth/login', { method: 'POST', data: { email: account.email, password: account.password } });
    assert.equal(result.status, 200, result.text);
    return result;
  }
  async register(account = READER) {
    await this.session();
    const result = await this.request('/api/auth/register', { method: 'POST', data: account });
    assert.equal(result.status, 201, result.text);
    return result;
  }
}
async function roles(owner) {
  const guest = owner.client(), admin = owner.client(), reader = owner.client();
  await guest.session(); await admin.login(); await reader.register();
  return { guest, admin, reader };
}
async function createArticle(admin, overrides = {}) {
  const result = await admin.request('/api/admin/articles', { method: 'POST', data: articleFixture(overrides) });
  assert.equal(result.status, 201, result.text);
  return result.json.article;
}
const mutate = (data, method = 'POST') => ({ method, data });

test('cloud PostgreSQL: opaque HTTPS sessions, CSRF and guest/reader/admin permissions', async t => {
  const owner = await fixture(); t.after(() => owner.close());
  const guest = owner.client();
  const initial = await guest.session(), anonymousCookie = guest.cookie, anonymousToken = guest.cookie.split('=')[1];
  assert.match(initial.headers.get('set-cookie'), /HttpOnly/);
  assert.match(initial.headers.get('set-cookie'), /SameSite=Lax/);
  assert.match(initial.headers.get('set-cookie'), /Secure/);
  assert.match(initial.headers.get('set-cookie'), /Path=\//);
  assert.match(anonymousToken, /^[a-f0-9]{64}$/);
  assert.equal(initial.json.user, null);
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  assert.equal(initial.headers.get('netlify-cdn-cache-control'), 'no-store');
  const sessionRow = (await owner.db.query('SELECT * FROM sessions WHERE token_hash=$1', [digest(anonymousToken)])).rows[0];
  assert.ok(sessionRow);
  assert.notEqual(sessionRow.token_hash, anonymousToken, 'only token hashes are persisted');
  for (const endpoint of ['/api/admin/articles', '/api/admin/users', '/api/admin/login-events', '/api/admin/comments', '/api/admin/uploads']) {
    assert.equal((await guest.request(endpoint)).status, 401);
    assert.equal((await guest.request(endpoint, mutate({ role: 'admin' }))).status, 401);
  }
  assert.equal((await guest.request('/api/auth/register', mutate({ ...READER, role: 'admin' }))).status, 422);
  assert.equal((await owner.db.query("SELECT count(*) AS total FROM users WHERE role='reader'")).rows[0].total, 0);
  const registration = await guest.request('/api/auth/register', mutate(READER));
  assert.equal(registration.status, 201, registration.text);
  assert.equal(registration.json.user.role, 'reader');
  assert.notEqual(guest.cookie, anonymousCookie, 'registration rotates the anonymous session');
  assert.equal((await owner.db.query('SELECT count(*) AS total FROM sessions WHERE token_hash=$1', [digest(anonymousToken)])).rows[0].total, 0);
  const accountRow = (await owner.db.query('SELECT password_hash,role FROM users WHERE id=$1', [registration.json.user.id])).rows[0];
  assert.match(accountRow.password_hash, /^scrypt\$/);
  assert.ok(!accountRow.password_hash.includes(READER.password));
  assert.equal(accountRow.role, 'reader');
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    for (const endpoint of ['/api/admin/articles', '/api/admin/users', '/api/admin/login-events', '/api/admin/comments', '/api/admin/uploads']) {
      assert.equal((await guest.request(endpoint, { method, ...(method === 'GET' ? {} : { data: { role: 'admin' } }) })).status, 403);
    }
  }
  const credentials = { email: READER.email, password: READER.password };
  assert.equal((await guest.request('/api/auth/login', { ...mutate(credentials), csrf: false })).status, 403);
  assert.equal((await guest.request('/api/auth/login', { ...mutate(credentials), csrf: false, headers: { 'X-CSRF-Token': '0'.repeat(64) } })).status, 403);
  assert.equal((await guest.request('/api/auth/login', { ...mutate(credentials), origin: 'https://evil.example.test' })).status, 403);
  assert.equal((await guest.request('/api/auth/login', { ...mutate(credentials), origin: null })).status, 403);
  assert.equal((await guest.request('/api/auth/login', { ...mutate(credentials), headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await guest.request('/api/auth/login', mutate({ ...credentials, password: 'Incorrect-Password!2026' }))).status, 401);
  const admin = owner.client(); await admin.login();
  assert.equal((await admin.request('/api/admin/users')).status, 200);
  // The Netlify owner grants the first cloud admin in the protected database
  // table editor. No browser API can grant this role; every request rechecks it.
  await owner.db.query("UPDATE users SET role='admin' WHERE id=$1", [registration.json.user.id]);
  assert.equal((await guest.session()).json.user.role, 'admin');
  assert.equal((await guest.request('/api/admin/users')).status, 200, 'trusted owner role promotion is immediately recognized');
  await owner.db.query("UPDATE users SET role='reader' WHERE id=$1", [registration.json.user.id]);
  assert.equal((await guest.request('/api/admin/users')).status, 403, 'revoking admin also applies to existing authenticated sessions');
  assert.equal((await guest.request('/.netlify/functions/spofy/api/health')).status, 200, 'rewritten function paths are normalized');
  const authenticatedCookie = guest.cookie;
  assert.equal((await guest.request('/api/auth/logout', mutate({}))).status, 200);
  assert.notEqual(guest.cookie, authenticatedCookie);
  assert.equal((await guest.session()).json.user, null);
  const replay = owner.client(); replay.cookie = authenticatedCookie;
  assert.equal((await replay.session()).json.user, null, 'a revoked authenticated token cannot be replayed');
  const mismatched = await owner.handle(new Request('https://wrong.example.test/api/auth/session'));
  assert.equal(mismatched.status, 403);
});

test('cloud PostgreSQL: drafts and private Blob media stay private until publication and revoke on unpublish', async t => {
  const owner = await fixture(); t.after(() => owner.close());
  const { guest, reader, admin } = await roles(owner);
  const imageOptions = { method: 'POST', body: PNG, headers: { 'Content-Type': 'image/png' } };
  assert.equal((await guest.request('/api/admin/uploads', imageOptions)).status, 401);
  assert.equal((await reader.request('/api/admin/uploads', imageOptions)).status, 403);
  assert.equal((await admin.request('/api/admin/uploads', { method: 'POST', body: '<svg></svg>', headers: { 'Content-Type': 'image/svg+xml' } })).status, 415);
  assert.equal((await admin.request('/api/admin/uploads', { ...imageOptions, body: Buffer.from('not a real PNG') })).status, 415);
  const upload = await admin.request('/api/admin/uploads', imageOptions);
  assert.equal(upload.status, 201, upload.text);
  const image = upload.json.image;
  assert.match(image.src, /^\/media\/[a-f0-9-]{36}\.png$/);
  assert.equal(image.width, 1); assert.equal(image.height, 1);
  assert.equal((await guest.request(image.src)).status, 404);
  assert.equal((await reader.request(image.src)).status, 404);
  assert.equal((await admin.request(image.src)).status, 200);
  const article = await createArticle(admin, {
    coverImage: image.src,
    blocks: [{ type: 'paragraph', text: 'Nội dung kiểm thử thật trong PostgreSQL tạm.' }, { type: 'image', src: image.src, alt: 'Ảnh kiểm thử', caption: 'Chú thích ảnh tạm' }, { type: 'formula', latex: 'E=mc^2', caption: 'Công thức kiểm thử' }],
    references: [{ label: 'Tài liệu kiểm thử', url: 'https://example.test/reference' }], featured: true,
  });
  assert.equal(article.status, 'draft');
  assert.equal((await guest.request('/api/articles')).json.total, 0);
  assert.equal((await guest.request(`/api/articles/${article.slug}`)).status, 404);
  assert.equal((await reader.request(`/api/articles/${article.slug}`)).status, 404);
  assert.equal((await guest.request(`/api/articles/${article.id}/comments`)).status, 404);
  assert.equal((await guest.request(image.src)).status, 404);
  assert.equal((await admin.request(`/api/admin/articles/${article.id}`)).status, 200);
  const publication = await admin.request(`/api/admin/articles/${article.id}`, mutate({ status: 'published' }, 'PATCH'));
  assert.equal(publication.status, 200, publication.text);
  assert.ok(publication.json.article.publishedAt);
  const listing = await guest.request('/api/articles?featured=1&category=vat-li&q=SONG&pageSize=1');
  assert.equal(listing.status, 200, listing.text); assert.equal(listing.json.total, 1); assert.equal(listing.json.items.length, 1);
  assert.equal(listing.json.items[0].blocks, undefined, 'list cards do not carry full article bodies');
  const detail = await guest.request(`/api/articles/${article.slug}`);
  assert.equal(detail.status, 200, detail.text); assert.equal(detail.json.article.blocks[2].latex, 'E=mc^2');
  assert.equal(detail.json.article.references.length, 1);
  const publicImage = await guest.request(image.src);
  assert.equal(publicImage.status, 200); assert.deepEqual(publicImage.bytes, PNG);
  assert.equal(publicImage.headers.get('cache-control'), 'private, no-store');
  assert.equal(publicImage.headers.get('netlify-cdn-cache-control'), 'no-store');
  assert.equal(publicImage.headers.get('content-type'), 'image/png');
  assert.equal((await guest.request(image.src, { method: 'HEAD' })).bytes.length, 0);
  const related = await createArticle(admin, { slug: 'bai-kiem-thu-lien-quan', status: 'published' });
  await createArticle(admin, { slug: 'ban-nhap-khong-lo-ra' });
  assert.deepEqual((await guest.request(`/api/articles/${article.slug}`)).json.related.map(item => item.id), [related.id]);
  assert.equal((await guest.request('/api/articles?q=%25')).json.total, 0, 'search treats percent as literal data');
  assert.equal((await guest.request('/api/articles?category=invalid')).status, 400);
  assert.equal((await guest.request('/api/articles?page=0')).status, 400);
  assert.equal((await guest.request('/api/articles?pageSize=25')).status, 400);
  assert.equal((await admin.request('/api/admin/articles', mutate(articleFixture({ slug: article.slug })))).status, 409);
  assert.equal((await admin.request('/api/admin/articles', mutate(articleFixture({ slug: 'khong-co-html', blocks: [{ type: 'html', html: '<script>alert(1)</script>' }] })))).status, 422);
  assert.equal((await admin.request('/api/admin/articles', mutate(articleFixture({ slug: 'link-khong-an-toan', references: [{ label: 'x', url: 'javascript:alert(1)' }] })))).status, 422);
  const before = (await admin.request('/api/admin/articles')).json.items.length;
  assert.equal((await admin.request('/api/admin/articles', mutate(articleFixture({ slug: 'anh-khong-ton-tai', coverImage: '/media/00000000-0000-0000-0000-000000000000.png' })))).status, 422);
  assert.equal((await admin.request('/api/admin/articles')).json.items.length, before, 'invalid media rolls back the article insert');
  assert.equal((await admin.request(`/api/admin/articles/${article.id}`, mutate({ status: 'draft' }, 'PATCH'))).status, 200);
  assert.equal((await guest.request(`/api/articles/${article.slug}`)).status, 404);
  assert.equal((await guest.request(image.src)).status, 404, 'unpublishing revokes every subsequent public image request');
  assert.equal((await admin.request(image.src)).status, 200);
  assert.equal((await admin.request(`/api/admin/articles/${article.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await admin.request(`/api/admin/articles/${article.id}`)).status, 404);
  const tooLarge = await admin.request('/api/admin/uploads', { ...imageOptions, body: Buffer.alloc(4 * 1024 * 1024 + 1) });
  assert.equal(tooLarge.status, 413);
});

test('cloud PostgreSQL: comment validation, duplicates, rate limits and admin-only moderation', async t => {
  const owner = await fixture(); t.after(() => owner.close());
  const { guest, reader, admin } = await roles(owner);
  const article = await createArticle(admin, { status: 'published' }), path = `/api/articles/${article.id}/comments`;
  assert.equal((await guest.request(path, mutate({ body: 'Khách chưa đăng nhập.' }))).status, 401);
  assert.equal((await reader.request(path, mutate({ body: 'ab' }))).status, 422);
  assert.equal((await reader.request(path, mutate({ body: 'a'.repeat(2001) }))).status, 422);
  const plainPayload = '<script>alert(1)</script> Bình luận dạng văn bản.';
  const initial = await reader.request(path, mutate({ body: plainPayload }));
  assert.equal(initial.status, 201, initial.text);
  assert.equal(initial.json.comment.body, plainPayload);
  assert.match(initial.headers.get('content-type'), /^application\/json/);
  assert.equal((await reader.request(path, mutate({ body: plainPayload }))).status, 409);
  assert.equal((await reader.request(path, mutate({ body: plainPayload.toUpperCase() }))).status, 409);
  assert.equal((await reader.request(path, mutate({ body: 'Bình luận khác gửi quá nhanh.' }))).status, 429);
  const commentId = initial.json.comment.id;
  for (const method of ['PATCH', 'DELETE']) {
    assert.equal((await reader.request(path, { method, data: { body: 'Sửa bình luận của mình.' } })).status, 403);
    assert.equal((await reader.request(`/api/admin/comments/${commentId}`, { method, data: { status: 'hidden' } })).status, 403);
  }
  assert.equal((await admin.request(`/api/admin/comments/${commentId}`, mutate({ status: 'hidden' }, 'PATCH'))).status, 200);
  assert.equal((await guest.request(path)).json.items.length, 0);
  assert.equal((await admin.request('/api/admin/comments')).json.items[0].status, 'hidden');
  assert.equal((await admin.request(`/api/admin/comments/${commentId}`, mutate({ status: 'visible' }, 'PATCH'))).status, 200);
  assert.equal((await guest.request(path)).json.items.length, 1);
  for (let index = 2; index <= 8; index++) {
    owner.advance(15_001);
    const sent = await reader.request(path, mutate({ body: `Bình luận kiểm thử hợp lệ số ${index}.` }));
    assert.equal(sent.status, 201, sent.text);
  }
  owner.advance(15_001);
  const limited = await reader.request(path, mutate({ body: 'Bình luận thứ chín bị giới hạn.' }));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal((await guest.request(path)).json.items.length, 8);
  assert.equal((await admin.request(`/api/admin/comments/${commentId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await guest.request(path)).json.items.length, 7);
  const otherReader = owner.client();
  await otherReader.register({ ...READER, email: 'other-reader@example.test' });
  const simultaneous = await Promise.all([
    otherReader.request(path, mutate({ body: 'Hai yêu cầu đồng thời có cùng nội dung.' })),
    otherReader.request(path, mutate({ body: 'Hai yêu cầu đồng thời có cùng nội dung.' })),
  ]);
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [201, 409], 'one atomic insert survives a duplicate race');
});

test('cloud PostgreSQL: private account audit, bounded history and durable state survive handler/database recreation', async t => {
  const owner = await fixture({ persistent: true }); t.after(() => owner.close());
  const { guest, reader, admin } = await roles(owner);
  const readerId = (await reader.session()).json.user.id;
  for (const endpoint of ['/api/admin/users', '/api/admin/login-events']) {
    assert.equal((await guest.request(endpoint)).status, 401);
    assert.equal((await reader.request(endpoint)).status, 403);
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      assert.equal((await reader.request(endpoint, mutate({ role: 'admin' }, method))).status, 403);
      assert.equal((await admin.request(endpoint, mutate({ role: 'admin' }, method))).status, 404);
    }
  }
  const users = await admin.request('/api/admin/users');
  assert.equal(users.status, 200, users.text); assert.equal(users.json.total, 2);
  assert.equal(users.json.historyRetentionLimit, 10_000);
  assert.ok(Number.isFinite(Date.parse(users.json.trackingStartedAt)));
  const userKeys = ['id', 'email', 'name', 'role', 'createdAt', 'lastLoginAt', 'loginCount', 'activeSessions'].sort();
  for (const user of users.json.items) assert.deepEqual(Object.keys(user).sort(), userKeys);
  const history = await admin.request('/api/admin/login-events');
  assert.equal(history.status, 200, history.text); assert.equal(history.json.total, 2);
  const eventKeys = ['id', 'userId', 'email', 'name', 'role', 'eventType', 'occurredAt'].sort();
  for (const event of history.json.items) assert.deepEqual(Object.keys(event).sort(), eventKeys);
  for (const response of [users, history]) {
    assert.doesNotMatch(response.text, /password|csrf_token|token_hash|session_token|ip_address|user_agent/i);
    assert.ok(!response.text.includes(ADMIN.password)); assert.ok(!response.text.includes(admin.cookie.split('=')[1]));
  }
  const search = await admin.request('/api/admin/users?q=doc%20gia&role=reader');
  assert.equal(search.json.total, 1, search.text); assert.equal(search.json.items[0].id, readerId);
  assert.equal((await admin.request('/api/admin/users?q=%25')).json.total, 0);
  assert.equal((await admin.request('/api/admin/users?q=%27%20OR%201%3D1')).json.total, 0);
  assert.equal((await admin.request('/api/admin/users?role=owner')).status, 400);
  assert.equal((await admin.request('/api/admin/users?page=0')).status, 400);
  assert.equal((await admin.request('/api/admin/login-events?pageSize=101')).status, 400);
  const firstPage = await admin.request('/api/admin/users?pageSize=1'), secondPage = await admin.request('/api/admin/users?page=2&pageSize=1');
  assert.equal(firstPage.json.totalPages, 2); assert.notEqual(firstPage.json.items[0].id, secondPage.json.items[0].id);
  const readerBefore = search.json.items[0];
  assert.equal(readerBefore.loginCount, 1); assert.equal(readerBefore.activeSessions, 1);
  await reader.session(); await reader.session();
  assert.equal((await reader.request('/api/auth/login', mutate({ email: READER.email, password: 'Incorrect-password!2026' }))).status, 401);
  assert.equal((await admin.request('/api/admin/users?role=reader')).json.items[0].loginCount, 1);
  owner.advance(60_000); await reader.login(READER);
  const afterLogin = (await admin.request('/api/admin/users?role=reader')).json.items[0];
  assert.equal(afterLogin.loginCount, 2); assert.equal(afterLogin.activeSessions, 1);
  assert.ok(Date.parse(afterLogin.lastLoginAt) > Date.parse(readerBefore.lastLoginAt));
  const article = await createArticle(admin, { status: 'published', slug: 'du-lieu-ben-vung-qua-khoi-dong' });
  owner.resetHandler();
  assert.equal((await guest.request(`/api/articles/${article.slug}`)).status, 200);
  assert.equal((await admin.request('/api/admin/users')).json.total, 2, 'new function instances read the same shared database');
  await owner.restartDatabase();
  assert.equal((await guest.request(`/api/articles/${article.slug}`)).json.article.id, article.id);
  const afterRestart = await admin.request('/api/admin/users');
  assert.equal(afterRestart.json.trackingStartedAt, users.json.trackingStartedAt, 're-applying migrations does not reset the audit start');
  assert.equal(afterRestart.json.items.find(user => user.id === readerId).loginCount, 2);
  assert.equal((await admin.request('/api/admin/login-events')).json.total, 3);
  await owner.db.query("INSERT INTO login_events(id,user_id,occurred_at,event_type) SELECT 'retention-test-'||n,$1,$2::BIGINT+n,'login' FROM generate_series(1,10005) n", [readerId, owner.now]);
  owner.advance(1_000_000); await reader.login(READER);
  const bounded = await admin.request('/api/admin/login-events');
  assert.equal(bounded.json.total, 10_000); assert.equal(bounded.json.historyRetentionLimit, 10_000);
  assert.equal((await owner.db.query("SELECT count(*) AS total FROM login_events WHERE id='retention-test-1'")).rows[0].total, 0);
  assert.equal((await admin.request('/api/admin/users?role=reader')).json.items[0].loginCount, 3, 'audit pruning preserves cumulative sign-in totals');
  assert.equal((await reader.request('/api/auth/logout', mutate({}))).status, 200);
  assert.equal((await admin.request('/api/admin/users?role=reader')).json.items[0].activeSessions, 0);
  owner.advance(8 * 24 * 3_600_000);
  assert.equal((await admin.session()).json.user, null, 'expired sessions do not keep admin access');
});

test('cloud PostgreSQL: a failed sign-in transaction leaves the previous session and audit counters intact', async t => {
  const owner = await fixture(); t.after(() => owner.close());
  const reader = owner.client();
  const registered = await reader.register(), cookie = reader.cookie;
  await owner.db.query("ALTER TABLE login_events ADD CONSTRAINT test_reject_new_login CHECK(event_type<>'login') NOT VALID");
  const failure = await reader.request('/api/auth/login', mutate({ email: READER.email, password: READER.password }));
  assert.equal(failure.status, 500);
  assert.equal(failure.json.error.code, 'INTERNAL_ERROR');
  assert.equal(failure.headers.get('set-cookie'), null, 'a rolled-back session must never be sent to the browser');
  assert.equal(reader.cookie, cookie);
  assert.equal((await reader.session()).json.user.id, registered.json.user.id, 'the previous authenticated session still works');
  const user = (await owner.db.query('SELECT login_count FROM users WHERE id=$1', [registered.json.user.id])).rows[0];
  assert.equal(user.login_count, 1);
  assert.equal((await owner.db.query('SELECT count(*) AS total FROM login_events')).rows[0].total, 1);
  assert.equal((await owner.db.query('SELECT count(*) AS total FROM sessions WHERE user_id=$1', [registered.json.user.id])).rows[0].total, 1);
  assert.doesNotMatch(failure.text, /constraint|postgres|password_hash|token_hash/i);
});
