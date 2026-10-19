import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { openDatabase } from '../server/db.mjs';
import { checkPassword, digest } from '../server/auth.mjs';
import { createAuthLifecycle, createEmailService, sqliteAuthAdapter, validateNewPassword } from '../server/auth-lifecycle.mjs';
import { createCloudHandler } from '../netlify/server/app.mjs';
import { normalizeResult } from '../netlify/server/database.mjs';
import { READER, startFixture } from './helpers.mjs';

const ORIGIN = 'https://auth-isolated.example.test';
const NEW_PASSWORD = 'A-new-science-passphrase-2026!';
const sql = await Promise.all(['0001_initial.sql', '0002_auth_lifecycle.sql'].map(file => readFile(new URL(`../netlify/database/migrations/${file}`, import.meta.url), 'utf8')));
const tokenIn = message => message.text.match(/#token=([a-f0-9]{64})/)[1];
const rejected = (status, code) => error => error.status === status && error.code === code;

async function fixture(dialect) {
  let engine, database;
  if (dialect === 'sqlite') { engine = openDatabase(':memory:'); database = sqliteAuthAdapter(engine); }
  else {
    engine = new PGlite();
    for (const migration of sql) await engine.exec(migration);
    const scoped = connection => ({ query: async (statement, args = []) => normalizeResult(await connection.query(statement, args)) });
    database = { ...scoped(engine), postgres: true, transaction: work => engine.transaction(connection => work(scoped(connection))) };
  }
  const messages = [], warnings = [];
  let clock = 1_800_000_000_000, deliveryFails = false;
  const mail = createEmailService({ env: { APP_ORIGIN: ORIGIN }, cloud: true, transport: async message => { if (deliveryFails) throw new Error('injected failure'); messages.push(message); } });
  const auth = createAuthLifecycle({ db: database, mail, now: () => clock, logger: { warn: value => warnings.push(value) } });
  return {
    db: database, engine, auth, messages, warnings,
    get now() { return clock; },
    get mailFails() { return deliveryFails; },
    advance: value => { clock += value; },
    failDelivery: value => { deliveryFails = value; },
    query: (statement, args) => database.query(statement, args),
    async row(statement, args = []) { return (await database.query(statement, args)).rows[0]; },
    async close() { await engine.close(); },
  };
}

for (const dialect of ['sqlite', 'postgres']) {
  test(`${dialect} auth: registration is reader-only, generic, hashed and inactive until a real verification link is consumed once`, async t => {
    const f = await fixture(dialect); t.after(() => f.close());
    const first = await f.auth.register(READER), user = await f.row('SELECT * FROM users WHERE email=$1', [READER.email]);
    assert.equal(user.role, 'reader'); assert.equal(user.email_verification_required, 1); assert.equal(user.email_verified_at, null);
    assert.equal(await checkPassword(READER.password, user.password_hash), true);
    assert.equal(f.messages.length, 1);
    const token = tokenIn(f.messages[0]);
    const saved = await f.row('SELECT * FROM auth_tokens WHERE token_hash=$1', [digest(token)]);
    assert.equal(saved.delivery_state, 'sent'); assert.equal(Number(saved.expires_at) - f.now, 24 * 3_600_000);
    assert.ok(!JSON.stringify(saved).includes(token)); assert.ok(!JSON.stringify(first).includes(token));
    const duplicate = await f.auth.register({ ...READER, name: 'Must not replace existing identity', password: NEW_PASSWORD });
    assert.deepEqual(duplicate, first); assert.equal(f.messages.length, 1);
    assert.equal((await f.row('SELECT name FROM users WHERE id=$1', [user.id])).name, READER.name);
    const races = await Promise.allSettled([f.auth.verify(token), f.auth.verify(token)]);
    assert.equal(races.filter(value => value.status === 'fulfilled').length, 1);
    assert.equal(races.filter(value => value.status === 'rejected' && value.reason.code === 'INVALID_AUTH_TOKEN').length, 1);
    assert.equal(Number((await f.row('SELECT email_verified_at FROM users WHERE id=$1', [user.id])).email_verified_at), f.now);
  });

  test(`${dialect} auth: missing email returns 503, authenticated resend errors are clear and expired links fail`, async t => {
    const f = await fixture(dialect); t.after(() => f.close());
    const noMail = createAuthLifecycle({ db: f.db, mail: createEmailService({ env: {}, cloud: true }) });
    await assert.rejects(noMail.register(READER), rejected(503, 'MAIL_NOT_CONFIGURED'));
    await assert.rejects(noMail.forgot(READER.email), rejected(503, 'MAIL_NOT_CONFIGURED'));
    assert.equal((await f.row('SELECT count(*) AS total FROM users')).total, 0);
    await f.auth.register(READER);
    const user = await f.row('SELECT id FROM users WHERE email=$1', [READER.email]), original = tokenIn(f.messages.at(-1));
    f.failDelivery(true);
    await assert.rejects(f.auth.resend(user.id), rejected(503, 'MAIL_DELIVERY_FAILED'));
    assert.equal((await f.row('SELECT count(*) AS total FROM auth_tokens')).total, 1, 'failed pending tokens are removed');
    await f.auth.verify(original);
    f.failDelivery(false);
    await f.auth.forgot(READER.email);
    const expiredReset = tokenIn(f.messages.at(-1));
    f.advance(30 * 60_000 + 1);
    await assert.rejects(f.auth.reset(expiredReset, NEW_PASSWORD), rejected(400, 'INVALID_AUTH_TOKEN'));
    assert.equal(await checkPassword(READER.password, (await f.row('SELECT password_hash FROM users WHERE id=$1', [user.id])).password_hash), true);
    await f.auth.register({ ...READER, email: 'expiry@example.test' });
    const expiredVerify = tokenIn(f.messages.at(-1)); f.advance(24 * 3_600_000 + 1);
    await assert.rejects(f.auth.verify(expiredVerify), rejected(400, 'INVALID_AUTH_TOKEN'));
  });

  test(`${dialect} auth: public delivery failures have the same neutral acceptance as unknown/existing email and never expose account data`, async t => {
    const f = await fixture(dialect); t.after(() => f.close());
    await f.auth.register(READER);
    const user = await f.row('SELECT * FROM users WHERE email=$1', [READER.email]);
    await f.auth.forgot(READER.email); const deliveredReset = tokenIn(f.messages.at(-1));
    f.failDelivery(true);
    const known = await f.auth.forgot(READER.email), unknown = await f.auth.forgot('unknown@example.test');
    assert.deepEqual(known, unknown);
    assert.doesNotMatch(JSON.stringify(known), /emailSent|sentAt|deliveryId|queued/i);
    assert.match(known.message, /không xác nhận/);
    const failedRegistration = await f.auth.register({ ...READER, email: 'new-failed@example.test' });
    const duplicateRegistration = await f.auth.register({ ...READER, name: 'Do not overwrite', password: NEW_PASSWORD });
    assert.deepEqual(failedRegistration, duplicateRegistration);
    assert.equal(await f.row('SELECT id FROM users WHERE email=$1', ['new-failed@example.test']), undefined, 'an unused account can be registered again after first delivery fails');
    assert.equal((await f.row('SELECT name FROM users WHERE id=$1', [user.id])).name, READER.name);
    assert.equal(await checkPassword(READER.password, (await f.row('SELECT password_hash FROM users WHERE id=$1', [user.id])).password_hash), true);
    assert.ok(f.warnings.length >= 2);
    assert.deepEqual([...new Set(f.warnings)], ['SPOFY auth mail: MAIL_DELIVERY_FAILED']);
    assert.ok(!JSON.stringify(f.warnings).includes(READER.email));
    await f.auth.reset(deliveredReset, NEW_PASSWORD);
  });

  test(`${dialect} auth: forgot-password has a generic response; reset is single-use, replaces the hash and revokes every user session`, async t => {
    const f = await fixture(dialect); t.after(() => f.close());
    await f.auth.register(READER); await f.auth.verify(tokenIn(f.messages.at(-1)));
    const user = await f.row('SELECT * FROM users WHERE email=$1', [READER.email]);
    const known = await f.auth.forgot(READER.email), reset1 = tokenIn(f.messages.at(-1));
    const count = f.messages.length, unknown = await f.auth.forgot('not-registered@example.test');
    assert.deepEqual(known, unknown); assert.equal(f.messages.length, count);
    await f.auth.forgot(READER.email);
    const reset2 = tokenIn(f.messages.at(-1));
    await assert.rejects(f.auth.reset(reset1, NEW_PASSWORD), rejected(400, 'INVALID_AUTH_TOKEN'));
    for (const number of [1, 2]) await f.query('INSERT INTO sessions(token_hash,csrf_token,user_id,created_at,expires_at,auth_version,user_role) VALUES($1,$2,$3,$4,$5,0,$6)', [digest(`session-${number}`), digest('csrf'), user.id, f.now, f.now + 100_000, 'reader']);
    const results = await Promise.allSettled([f.auth.reset(reset2, NEW_PASSWORD), f.auth.reset(reset2, NEW_PASSWORD)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'INVALID_AUTH_TOKEN').length, 1);
    const changed = await f.row('SELECT * FROM users WHERE id=$1', [user.id]);
    assert.notEqual(changed.password_hash, user.password_hash); assert.equal(changed.auth_version, 1);
    assert.equal(await checkPassword(READER.password, changed.password_hash), false);
    assert.equal(await checkPassword(NEW_PASSWORD, changed.password_hash), true);
    assert.equal((await f.row('SELECT count(*) AS total FROM sessions WHERE user_id=$1', [user.id])).total, 0);
    assert.equal((await f.row('SELECT count(*) AS total FROM auth_tokens WHERE consumed_at IS NULL')).total, 0);
  });

  test(`${dialect} auth: a trusted database role change revokes sessions/tokens; legacy users keep an unknown verification state`, async t => {
    const f = await fixture(dialect); t.after(() => f.close());
    await f.auth.register(READER); const user = await f.row('SELECT * FROM users WHERE email=$1', [READER.email]);
    await f.query('INSERT INTO sessions(token_hash,csrf_token,user_id,created_at,expires_at,auth_version,user_role) VALUES($1,$2,$3,$4,$5,0,$6)', [digest('session'), digest('csrf'), user.id, f.now, f.now + 100_000, 'reader']);
    await f.query("UPDATE users SET role='admin' WHERE id=$1", [user.id]);
    assert.equal((await f.row('SELECT count(*) AS total FROM sessions WHERE user_id=$1', [user.id])).total, 0);
    assert.equal((await f.row('SELECT auth_version FROM users WHERE id=$1', [user.id])).auth_version, 1);
    await assert.rejects(f.auth.verify(tokenIn(f.messages.at(-1))), rejected(400, 'INVALID_AUTH_TOKEN'));
    await f.query("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES($1,$2,$3,$4,'reader',$5)", [randomUUID(), 'legacy@example.test', 'Tài khoản cũ', user.password_hash, f.now]);
    const legacy = await f.row('SELECT email_verified_at,email_verification_required FROM users WHERE email=$1', ['legacy@example.test']);
    assert.equal(legacy.email_verified_at, null); assert.equal(legacy.email_verification_required, 0);
  });
}

test('password policy blocks common/repeated strings; HIBP sends only a padded five-character SHA-1 range and fails honestly', async () => {
  for (const value of ['123456789012', 'Password123456!', 'aaaaaaaaaaaa', 'qwertyuiop123456']) await assert.rejects(validateNewPassword(value), rejected(422, 'WEAK_PASSWORD'));
  const hash = createHash('sha1').update(NEW_PASSWORD).digest('hex').toUpperCase();
  let requested;
  await validateNewPassword(NEW_PASSWORD, { mode: 'hibp', fetcher: async (url, options) => { requested = { url, options }; return new Response(`${'A'.repeat(35)}:0\r\n`); } });
  assert.equal(requested.url, `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
  assert.equal(requested.options.headers['Add-Padding'], 'true'); assert.ok(!JSON.stringify(requested).includes(NEW_PASSWORD)); assert.ok(!requested.url.includes(hash));
  await assert.rejects(validateNewPassword(NEW_PASSWORD, { mode: 'hibp', fetcher: async () => new Response(`${hash.slice(5)}:123\r\n`) }), rejected(422, 'BREACHED_PASSWORD'));
  await assert.rejects(validateNewPassword(NEW_PASSWORD, { mode: 'hibp', fetcher: async () => new Response('unavailable', { status: 503 }) }), rejected(503, 'PASSWORD_CHECK_UNAVAILABLE'));
  await assert.rejects(validateNewPassword(NEW_PASSWORD, { mode: 'hibp', fetcher: async () => new Response('') }), rejected(503, 'PASSWORD_CHECK_UNAVAILABLE'));
});

test('mail adapter requires an exact HTTPS origin on cloud and disables preview delivery unless a test mailbox is configured', async () => {
  const base = { APP_ORIGIN: ORIGIN, RESEND_API_KEY: 'test-key-never-used', MAIL_FROM: 'SPOFY <test@example.test>' };
  assert.equal(createEmailService({ env: { ...base, APP_ORIGIN: 'http://example.test' }, cloud: true }).configured, false);
  assert.equal(createEmailService({ env: { ...base, CONTEXT: 'deploy-preview' }, cloud: true }).configured, false);
  let sent;
  const mail = createEmailService({ env: { ...base, CONTEXT: 'deploy-preview', MAIL_MODE: 'test', MAIL_TEST_RECIPIENT: 'tester@example.test' }, cloud: true, fetcher: async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); sent = JSON.parse(options.body); return Response.json({ id: 'mock-delivery-id' }); } });
  await mail.send({ to: 'unrelated@example.test', purpose: 'verify', token: 'a'.repeat(64) });
  assert.equal(sent.to, 'tester@example.test'); assert.ok(!sent.text.includes('test-key')); assert.match(sent.text, /https:\/\/auth-isolated\.example\.test\/xac-minh-email#token=/);
});

test('Deploy Preview/branch APIs cannot touch a database before isolated-data confirmation', async () => {
  for (const context of ['deploy-preview', 'branch-deploy']) {
    let queries = 0;
    const handler = createCloudHandler({ db: { async query() { queries++; throw new Error('must not query'); }, async transaction() { queries++; throw new Error('must not transact'); } }, storage: { async put() {}, async get() {}, async delete() {} }, env: { CONTEXT: context, APP_ORIGIN: ORIGIN } });
    const result = await handler(new Request(ORIGIN + '/api/auth/session'));
    assert.equal(result.status, 503); assert.equal((await result.json()).error.code, 'PREVIEW_DATA_NOT_CONFIRMED'); assert.equal(queries, 0);
  }
});

test('SQLite HTTP login rollback never sends a failed session cookie or destroys the previous authenticated session', async t => {
  const owner = await startFixture({ logger: { error() {} } }); t.after(() => owner.close());
  const reader = owner.client();
  const verified = await reader.register(), originalCookie = new Map(reader.cookies);
  assert.equal(verified.status, 200);
  owner.app.db.exec("CREATE TRIGGER test_login_audit_failure BEFORE INSERT ON login_events WHEN NEW.event_type='login' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END;");
  const failed = await reader.request('/api/auth/login', { method: 'POST', data: { email: READER.email, password: READER.password } });
  assert.equal(failed.status, 500); assert.equal(failed.headers.get('set-cookie'), null);
  assert.deepEqual(reader.cookies, originalCookie);
  assert.equal((await reader.session()).json.user.id, verified.json.user.id);
  assert.equal(owner.app.db.prepare('SELECT login_count FROM users WHERE id=?').get(verified.json.user.id).login_count, 1);
  assert.equal(owner.app.db.prepare('SELECT count(*) AS total FROM sessions WHERE user_id=?').get(verified.json.user.id).total, 1);
  assert.doesNotMatch(failed.text, /trigger|constraint|password_hash|token_hash|injected/i);
});

test('PostgreSQL HTTP handler gates new-reader comments, applies Origin/CSRF to reset, limits requests and keeps existing-user login working without email', async t => {
  const f = await fixture('postgres'); t.after(() => f.close());
  const storage = { async put() {}, async get() { return null; }, async delete() {} };
  const handler = createCloudHandler({ db: f.db, storage, env: { APP_ORIGIN: ORIGIN }, now: () => f.now, mailTransport: async message => { if (f.mailFails) throw new Error('injected delivery failure'); f.messages.push(message); } });
  let cookie = '', csrf = '';
  async function request(path, data, overrides = {}) {
    const headers = { Origin: ORIGIN, 'X-Nf-Client-Connection-Ip': '203.0.113.9', ...(cookie ? { Cookie: cookie } : {}), ...(data ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}), ...overrides };
    const result = await handler(new Request(ORIGIN + path, { method: data ? 'POST' : 'GET', headers, ...(data ? { body: JSON.stringify(data) } : {}) }));
    if (result.headers.has('set-cookie')) cookie = result.headers.get('set-cookie').split(';')[0];
    const body = await result.json(); if (body.csrfToken) csrf = body.csrfToken;
    return { status: result.status, body, headers: result.headers };
  }
  assert.equal((await request('/api/auth/session')).body.capabilities.emailConfigured, true);
  const pending = await request('/api/auth/register', READER); assert.equal(pending.status, 202); assert.equal(pending.body.user, null);
  assert.equal((await request('/api/auth/register', { ...READER, role: 'admin' })).status, 422);
  const login = await request('/api/auth/login', { email: READER.email, password: READER.password });
  assert.equal(login.status, 200); assert.equal(login.body.user.emailVerified, false);
  const user = await f.row('SELECT id,password_hash FROM users WHERE email=$1', [READER.email]);
  const articleId = randomUUID();
  await f.query("INSERT INTO articles(id,title,slug,summary,category,author,status,created_at,updated_at,created_by) VALUES($1,'Fixture','temporary-article','Fixture summary','stem','Fixture','published',$2,$2,$3)", [articleId, f.now, user.id]);
  assert.equal((await request(`/api/articles/${articleId}/comments`, { body: 'Bình luận bị chặn trước khi xác minh.' })).body.error.code, 'EMAIL_NOT_VERIFIED');
  assert.equal((await request('/api/auth/forgot-password', { email: READER.email }, { Origin: 'https://attacker.example.test' })).status, 403);
  assert.equal((await request('/api/auth/reset-password', { token: 'a'.repeat(64), password: NEW_PASSWORD }, { 'X-CSRF-Token': '' })).status, 403);
  const verified = await request('/api/auth/verify-email', { token: tokenIn(f.messages.at(-1)) });
  assert.equal(verified.status, 200); assert.equal(verified.body.user.emailVerified, true);
  assert.equal((await request(`/api/articles/${articleId}/comments`, { body: 'Bình luận sau khi xác minh email.' })).status, 201);
  for (let i = 0; i < 5; i++) assert.equal((await request('/api/auth/forgot-password', { email: `unknown${i}@example.test` })).status, 202);
  assert.equal((await request('/api/auth/forgot-password', { email: 'another@example.test' })).status, 429);
  f.failDelivery(true);
  const otherIp = { 'X-Nf-Client-Connection-Ip': '203.0.113.10' };
  const failedKnown = await request('/api/auth/forgot-password', { email: READER.email }, otherIp);
  const missingEmail = await request('/api/auth/forgot-password', { email: 'missing@example.test' }, otherIp);
  assert.equal(failedKnown.status, 202); assert.equal(missingEmail.status, 202); assert.deepEqual(failedKnown.body, missingEmail.body);
  const failedNew = await request('/api/auth/register', { ...READER, email: 'failed-new@example.test' }, otherIp);
  const duplicate = await request('/api/auth/register', READER, otherIp);
  assert.equal(failedNew.status, 202); assert.equal(duplicate.status, 202); assert.deepEqual(failedNew.body, duplicate.body);
  assert.equal(await f.row('SELECT id FROM users WHERE email=$1', ['failed-new@example.test']), undefined);
  const noMailHandler = createCloudHandler({ db: f.db, storage, env: { APP_ORIGIN: ORIGIN }, now: () => f.now });
  const current = await noMailHandler(new Request(ORIGIN + '/api/auth/session', { headers: { Cookie: cookie } }));
  assert.equal((await current.json()).capabilities.emailConfigured, false);
  const direct = await noMailHandler(new Request(ORIGIN + '/api/auth/login', { method: 'POST', headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ email: READER.email, password: READER.password }) }));
  assert.equal(direct.status, 200, 'mail configuration cannot lock out existing accounts');
});
