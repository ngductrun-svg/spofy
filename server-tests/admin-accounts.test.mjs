import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { openDatabase, transaction } from '../server/db.mjs';
import { recordSignIn, LOGIN_HISTORY_LIMIT } from '../server/auth.mjs';
import { startFixture, setupRoles, ADMIN, READER } from './helpers.mjs';

test('migration v2 preserves legacy credentials and sessions without inventing sign-in history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spofy-account-migration-test-'));
  const path = join(directory, 'legacy.sqlite');
  let db;
  try {
    db = new DatabaseSync(path);
    db.exec(`
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader','admin')),created_at INTEGER NOT NULL) STRICT;
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,csrf_token TEXT NOT NULL,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL) STRICT;
    `);
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('legacy', 'old@example.test', 'Tài khoản cũ', 'unchanged-legacy-password-hash', 'admin', 1000);
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('existing-token-hash', 'existing-csrf-token', 'legacy', Date.now() + 100_000, 2000);
    db.close();
    db = openDatabase(path);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get('legacy');
    assert.equal(user.password_hash, 'unchanged-legacy-password-hash');
    assert.equal(user.created_at, 1000);
    assert.equal(user.last_login_at, null);
    assert.equal(user.login_count, 0);
    assert.equal(db.prepare('SELECT count(*) AS total FROM login_events').get().total, 0);
    assert.equal(db.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get('legacy').token_hash, 'existing-token-hash');
    const appliedAt = db.prepare('SELECT applied_at FROM schema_migrations WHERE version=2').get().applied_at;
    assert.ok(appliedAt > 0);
    transaction(db, () => recordSignIn(db, 'legacy', 'login', 5000));
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT applied_at FROM schema_migrations WHERE version=2').get().applied_at, appliedAt);
    const migrated = db.prepare('SELECT * FROM users WHERE id=?').get('legacy');
    assert.equal(migrated.last_login_at, 5000);
    assert.equal(migrated.login_count, 1);
    assert.equal(db.prepare('SELECT count(*) AS total FROM login_events').get().total, 1);
  } finally {
    if (db?.isOpen) db.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
});

test('account listing and sign-in history reject guests/readers and expose only approved fields', async t => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const { guest, reader, admin } = await setupRoles(fixture);
  for (const path of ['/api/admin/users', '/api/admin/login-events']) {
    assert.equal((await guest.request(path)).status, 401);
    assert.equal((await reader.request(path)).status, 403);
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      assert.equal((await reader.request(path, { method, data: { role: 'admin' } })).status, 403);
      assert.equal((await admin.request(path, { method, data: { role: 'admin' } })).status, 404);
    }
  }
  const listing = await admin.request('/api/admin/users');
  assert.equal(listing.status, 200, listing.text);
  assert.equal(listing.json.total, 2);
  assert.ok(Number.isFinite(Date.parse(listing.json.trackingStartedAt)));
  assert.equal(listing.json.historyRetentionLimit, 10_000);
  const expectedUserKeys = ['id', 'email', 'name', 'role', 'emailVerified', 'createdAt', 'lastLoginAt', 'loginCount', 'activeSessions'].sort();
  for (const item of listing.json.items) assert.deepEqual(Object.keys(item).sort(), expectedUserKeys);
  const history = await admin.request('/api/admin/login-events');
  assert.equal(history.status, 200, history.text);
  assert.equal(history.json.total, 2);
  const expectedEventKeys = ['id', 'userId', 'name', 'email', 'role', 'eventType', 'occurredAt'].sort();
  for (const item of history.json.items) assert.deepEqual(Object.keys(item).sort(), expectedEventKeys);
  for (const result of [listing, history]) {
    assert.doesNotMatch(result.text, /password|token_hash|csrf_token|session_token|user_agent|ip_address/i);
    assert.ok(!result.text.includes(ADMIN.password));
    assert.ok(!result.text.includes(READER.password));
    for (const token of admin.cookies.values()) assert.ok(!result.text.includes(token));
  }
});

test('registration and successful login are counted once; failures and session checks are not', async t => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const admin = fixture.client();
  await admin.login();
  const reader = fixture.client();
  const registration = await reader.register();
  assert.equal(registration.status, 200, registration.text);
  const readerId = registration.json.user.id;
  await reader.session();
  await reader.session();
  let users = await admin.request('/api/admin/users?q=reader%40example.test');
  assert.equal(users.json.items[0].loginCount, 1);
  const firstTime = users.json.items[0].lastLoginAt;
  assert.equal(users.json.items[0].activeSessions, 1);
  const duplicate = await fixture.client().register();
  assert.equal(duplicate.status, 202);
  const invalid = await reader.request('/api/auth/login', { method: 'POST', data: { email: READER.email, password: 'WrongPassword!2026' } });
  assert.equal(invalid.status, 401);
  const csrfFailure = await reader.request('/api/auth/login', { method: 'POST', csrf: false, data: { email: READER.email, password: READER.password } });
  assert.equal(csrfFailure.status, 403);
  users = await admin.request('/api/admin/users?q=reader%40example.test');
  assert.equal(users.json.items[0].loginCount, 1);
  assert.equal(users.json.items[0].lastLoginAt, firstTime);
  fixture.advance(60_000);
  await reader.login(READER);
  users = await admin.request('/api/admin/users?q=reader%40example.test');
  assert.equal(users.json.items[0].loginCount, 2);
  assert.ok(Date.parse(users.json.items[0].lastLoginAt) > Date.parse(firstTime));
  assert.equal(users.json.items[0].activeSessions, 1, 'login rotates the old authenticated session');
  const events = await admin.request('/api/admin/login-events?q=reader%40example.test');
  assert.equal(events.json.total, 2);
  assert.deepEqual(events.json.items.map(item => item.eventType), ['login', 'register']);
  assert.ok(events.json.items.every(item => item.userId === readerId));
  await fixture.restart();
  users = await admin.request('/api/admin/users?q=reader%40example.test');
  assert.equal(users.status, 200, users.text);
  assert.equal(users.json.items[0].loginCount, 2);
  assert.equal((await admin.request('/api/admin/login-events?q=reader%40example.test')).json.total, 2);
});

test('active sessions count expiry and logout accurately without claiming a reader is online', async t => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const { admin, reader } = await setupRoles(fixture);
  const second = fixture.client();
  await second.login(READER);
  const getReader = async () => (await admin.request('/api/admin/users?q=reader%40example.test')).json.items[0];
  assert.equal((await getReader()).activeSessions, 2);
  const logout = await reader.request('/api/auth/logout', { method: 'POST', data: {} });
  assert.equal(logout.status, 200, logout.text);
  assert.equal((await getReader()).activeSessions, 1);
  fixture.advance(8 * 24 * 60 * 60_000);
  await admin.login();
  assert.equal((await getReader()).activeSessions, 0);
  assert.equal((await getReader()).loginCount, 2, 'logging out does not change recorded sign-in count');
});

test('account search is literal, accent-insensitive and paginated; invalid filters return clear errors', async t => {
  const fixture = await startFixture({ limits: { register: { count: 0 }, login: { count: 0 } } });
  t.after(() => fixture.close());
  const admin = fixture.client();
  await admin.login();
  for (const [index, name] of ['Nguyễn Minh', 'Đặng Hà', 'STEM 100%_Team'].entries()) {
    fixture.advance(1000);
    const response = await fixture.client().register({ ...READER, email: `member${index}@example.test`, name });
    assert.equal(response.status, 200, response.text);
  }
  let result = await admin.request('/api/admin/users?q=NGUYEN');
  assert.equal(result.json.total, 1);
  assert.equal(result.json.items[0].name, 'Nguyễn Minh');
  result = await admin.request('/api/admin/users?q=%25_');
  assert.equal(result.json.total, 1, 'wildcards are treated as literal text');
  result = await admin.request('/api/admin/users?q=%27%20OR%201%3D1--');
  assert.equal(result.json.total, 0, 'SQL-like input is not interpreted as SQL');
  result = await admin.request('/api/admin/users?role=reader&pageSize=2&page=1');
  assert.equal(result.json.total, 3);
  assert.equal(result.json.totalPages, 2);
  assert.equal(result.json.items.length, 2);
  const next = await admin.request('/api/admin/users?role=reader&pageSize=2&page=2');
  assert.equal(next.json.items.length, 1);
  assert.ok(!result.json.items.some(item => item.id === next.json.items[0].id));
  const admins = await admin.request('/api/admin/users?role=admin');
  assert.equal(admins.json.total, 1);
  assert.equal(admins.json.items[0].email, ADMIN.email);
  const events = await admin.request('/api/admin/login-events?q=dang&pageSize=1');
  assert.equal(events.json.total, 1);
  assert.equal(events.json.items[0].name, 'Đặng Hà');
  for (const path of ['/api/admin/users?role=owner', '/api/admin/users?page=0', '/api/admin/users?pageSize=101', '/api/admin/login-events?page=-1', '/api/admin/login-events?q=' + 'x'.repeat(101)]) {
    const invalid = await admin.request(path);
    assert.ok([400, 422].includes(invalid.status), invalid.text);
    assert.ok(invalid.json.error.message);
  }
});

test('audit history retains a bounded recent set while cumulative counts stay accurate', async t => {
  const fixture = await startFixture();
  t.after(() => fixture.close());
  const db = fixture.app.db;
  const user = db.prepare("SELECT id FROM users WHERE role='admin'").get();
  const insert = db.prepare("INSERT INTO login_events(id,user_id,occurred_at,event_type) VALUES(?,?,?,'login')");
  transaction(db, () => {
    for (let i = 0; i < LOGIN_HISTORY_LIMIT + 2; i++) insert.run(`temporary-audit-${i}`, user.id, i);
    db.prepare('UPDATE users SET login_count=? WHERE id=?').run(LOGIN_HISTORY_LIMIT + 2, user.id);
    recordSignIn(db, user.id, 'login', LOGIN_HISTORY_LIMIT + 100);
  });
  assert.equal(db.prepare('SELECT count(*) AS total FROM login_events').get().total, LOGIN_HISTORY_LIMIT);
  assert.equal(db.prepare('SELECT id FROM login_events WHERE id=?').get('temporary-audit-0'), undefined);
  const account = db.prepare('SELECT login_count,last_login_at FROM users WHERE id=?').get(user.id);
  assert.equal(account.login_count, LOGIN_HISTORY_LIMIT + 3);
  assert.equal(account.last_login_at, LOGIN_HISTORY_LIMIT + 100);
});
