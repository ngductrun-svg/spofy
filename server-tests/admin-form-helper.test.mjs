import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/db.mjs';
import { hashPassword, checkPassword } from '../server/auth.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const bootstrap = await readFile(new URL('../scripts/admin-form-bootstrap.mjs', import.meta.url), 'utf8');
// Exactly the same self-contained data-URL execution used by the Windows form.
const embedded = `import('data:text/javascript;base64,${Buffer.from(bootstrap, 'utf8').toString('base64')}')`;
const PASSWORD = 'Mật_khẩu✨SPOFY_2026!';
const defaults = { name: 'Quản trị khoa học', email: 'admin@example.test', password: PASSWORD, confirmPassword: PASSWORD };

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), "SPOFY form ' # % "));
  const root = join(parent, "Bản SPOFY ' có khoảng trắng # %");
  await mkdir(root);
  await cp(join(project, 'server'), join(root, 'server'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'spofy-science', type: 'module' }));
  t.after(() => rm(parent, { recursive: true, force: true }));
  return { root, dbPath: join(root, 'data', 'spofy.sqlite') };
}

function cleanEnv() {
  const env = { ...process.env, NODE_NO_WARNINGS: '1' };
  for (const key of Object.keys(env)) {
    if (['DATA_DIR', 'DB_PATH', 'MEDIA_DIR', 'DIST_DIR', 'APP_ORIGIN', 'NODE_ENV', 'PORT', 'HOST', 'NODE_OPTIONS'].includes(key.toUpperCase())) delete env[key];
  }
  return env;
}

async function run(root, values = {}) {
  const input = { projectDir: root, ...defaults, ...values };
  const args = ['--input-type=module', '--eval', embedded];
  assert.ok(!args.some(argument => argument.includes(input.password)), 'password is absent from process arguments');
  const child = spawn(process.execPath, args, { cwd: tmpdir(), env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exitCode = await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('admin helper timed out')); }, 20000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolveExit(code); });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(input), 'utf8');
  });
  assert.equal(stdout.trim().split(/\r?\n/u).length, 1, 'exactly one JSON output line');
  const result = JSON.parse(stdout.trim());
  assert.equal(exitCode, result.ok ? 0 : 1);
  if (input.password) assert.ok(!(stdout + stderr).includes(input.password), 'password is absent from all output');
  if (input.confirmPassword) assert.ok(!(stdout + stderr).includes(input.confirmPassword), 'password confirmation is absent from all output');
  assert.ok(!/scrypt\$32768\$8\$1\$/u.test(stdout + stderr), 'password hashes are absent from output');
  assert.ok(!/\n\s+at /u.test(stderr), 'no stack trace is printed');
  return result;
}

async function absent(path) { await assert.rejects(access(path)); }

async function seedReader(dbPath, { withSession = false } = {}) {
  const db = openDatabase(dbPath);
  const hash = await hashPassword(PASSWORD);
  db.prepare("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?, 'reader',?)")
    .run('reader-test', 'reader@example.test', 'Độc giả ban đầu', hash, Date.now());
  if (withSession) db.prepare('INSERT INTO sessions(token_hash,csrf_token,user_id,expires_at,created_at) VALUES(?,?,?,?,?)')
    .run('existing-session-token-hash', 'existing-csrf-token', 'reader-test', Date.now() + 600000, Date.now());
  db.close();
  return hash;
}

test('form creates a real first admin with Unicode credentials and safely handles quoted/spaced project paths', async t => {
  const { root, dbPath } = await fixture(t);
  await absent(dbPath);
  const result = await run(root, { email: '  ADMIN@EXAMPLE.TEST  ' });
  assert.deepEqual(result, {
    ok: true, action: 'created', email: 'admin@example.test', projectDir: root, dbPath,
    loginUrl: 'http://127.0.0.1:3000/dang-nhap?next=%2Fadmin',
  });
  const db = openDatabase(dbPath);
  try {
    const user = db.prepare('SELECT * FROM users').get();
    assert.equal(user.role, 'admin');
    assert.equal(user.name, defaults.name);
    assert.notEqual(user.password_hash, PASSWORD);
    assert.equal(await checkPassword(PASSWORD, user.password_hash), true);
    assert.equal(await checkPassword('Incorrect_Password_2026!', user.password_hash), false);
  } finally { db.close(); }
});

test('form blocks any second admin without changing the first account', async t => {
  const { root, dbPath } = await fixture(t);
  assert.equal((await run(root)).ok, true);
  const result = await run(root, { email: 'other-admin@example.test' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ADMIN_EXISTS');
  const db = openDatabase(dbPath);
  try { assert.equal(db.prepare("SELECT count(*) AS count FROM users WHERE role='admin'").get().count, 1); }
  finally { db.close(); }
});

test('default create mode never promotes an existing reader email', async t => {
  const { root, dbPath } = await fixture(t);
  const hash = await seedReader(dbPath);
  const result = await run(root, { email: 'reader@example.test' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EMAIL_EXISTS');
  const db = openDatabase(dbPath);
  try {
    const user = db.prepare('SELECT * FROM users').get();
    assert.equal(user.role, 'reader');
    assert.equal(user.password_hash, hash);
    assert.equal(db.prepare('SELECT count(*) AS count FROM users').get().count, 1);
  } finally { db.close(); }
});

test('explicit existing mode rejects an incorrect password without promoting or revoking sessions', async t => {
  const { root, dbPath } = await fixture(t);
  const hash = await seedReader(dbPath, { withSession: true });
  const result = await run(root, { mode: 'existing', name: '', email: 'reader@example.test', password: 'Wrong_Password_2026!', confirmPassword: 'Wrong_Password_2026!' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AUTH_INVALID');
  const db = openDatabase(dbPath);
  try {
    const user = db.prepare('SELECT * FROM users').get();
    assert.equal(user.role, 'reader');
    assert.equal(user.password_hash, hash);
    assert.equal(db.prepare('SELECT count(*) AS count FROM sessions').get().count, 1);
  } finally { db.close(); }
});

test('explicit existing mode promotes only the verified first reader and revokes old sessions without changing password or name', async t => {
  const { root, dbPath } = await fixture(t);
  const hash = await seedReader(dbPath, { withSession: true });
  const result = await run(root, { mode: 'existing', name: '', email: 'reader@example.test' });
  assert.equal(result.ok, true);
  assert.equal(result.action, 'promoted');
  assert.equal(result.email, 'reader@example.test');
  const db = openDatabase(dbPath);
  try {
    const user = db.prepare('SELECT * FROM users').get();
    assert.equal(user.role, 'admin');
    assert.equal(user.name, 'Độc giả ban đầu');
    assert.equal(user.password_hash, hash);
    assert.equal(db.prepare('SELECT count(*) AS count FROM sessions').get().count, 0);
    assert.equal(db.prepare('SELECT count(*) AS count FROM users').get().count, 1);
  } finally { db.close(); }
});

test('existing mode refuses promotion after an admin already exists', async t => {
  const { root, dbPath } = await fixture(t);
  await seedReader(dbPath);
  assert.equal((await run(root)).ok, true);
  const result = await run(root, { mode: 'existing', email: 'reader@example.test' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ADMIN_EXISTS');
  const db = openDatabase(dbPath);
  try { assert.equal(db.prepare("SELECT role FROM users WHERE id='reader-test'").get().role, 'reader'); }
  finally { db.close(); }
});

test('password mismatch and invalid lengths are rejected before creating a database', async t => {
  const { root, dbPath } = await fixture(t);
  const mismatch = await run(root, { confirmPassword: 'Different_Password_2026!' });
  assert.equal(mismatch.code, 'PASSWORD_MISMATCH');
  await absent(dbPath);
  for (const password of ['12345678901', 'x'.repeat(129)]) {
    const result = await run(root, { password, confirmPassword: password });
    assert.equal(result.code, 'INVALID_INPUT');
    await absent(dbPath);
  }
});

test('unexpected role/additional flags and invalid modes are rejected before creating a database', async t => {
  const { root, dbPath } = await fixture(t);
  for (const extra of [{ role: 'admin' }, { allowAdditional: true }, { mode: 'promote-without-password' }]) {
    const result = await run(root, extra);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_INPUT');
    await absent(dbPath);
  }
});

test('selected project config determines the database path and login URL, independently of the launcher working directory', async t => {
  const { root, dbPath } = await fixture(t);
  const customDb = join(root, "Dữ liệu ' có dấu # %", 'custom.sqlite');
  await writeFile(join(root, '.env'), `DB_PATH="./Dữ liệu ' có dấu # %/custom.sqlite"\nAPP_ORIGIN=http://127.0.0.1:39001\n`, 'utf8');
  const result = await run(root);
  assert.equal(result.ok, true);
  assert.equal(resolve(result.dbPath), resolve(customDb));
  assert.equal(result.loginUrl, 'http://127.0.0.1:39001/dang-nhap?next=%2Fadmin');
  await access(customDb);
  await absent(dbPath);
});

test('wrong projects and oversized credential payloads return safe errors without writing a database', async t => {
  const { root, dbPath } = await fixture(t);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'different-application', type: 'module' }));
  const wrong = await run(root);
  assert.equal(wrong.code, 'PROJECT_INVALID');
  await absent(dbPath);
  const password = 'z'.repeat(20000);
  const oversized = await run(root, { password, confirmPassword: password });
  assert.equal(oversized.code, 'INVALID_INPUT');
  await absent(dbPath);
});

test('simultaneous helper launches serialize the first-admin check', async t => {
  const { root, dbPath } = await fixture(t);
  openDatabase(dbPath).close();
  const results = await Promise.all([
    run(root, { email: 'first@example.test' }), run(root, { email: 'second@example.test' }),
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.find(result => !result.ok).code, 'ADMIN_EXISTS');
  const db = openDatabase(dbPath);
  try { assert.equal(db.prepare("SELECT count(*) AS count FROM users WHERE role='admin'").get().count, 1); }
  finally { db.close(); }
});
