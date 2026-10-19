import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { email as validEmail, password as validPassword, plain } from './validation.mjs';
import { fail } from './errors.mjs';

const scrypt = promisify(scryptCallback);
const HASH_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const COOKIE_NAME = 'spofy_session';
export const digest = value => createHash('sha256').update(value).digest('hex');
export const publicUser = row => row ? { id: row.id, email: row.email, name: row.name, role: row.role, emailVerified: row.email_verified_at != null ? true : Number(row.email_verification_required) === 1 ? false : null } : null;
export const LOGIN_HISTORY_LIMIT = 10_000;

// Called in the same transaction as session creation. Completing registration
// by email verification starts a session; trusted CLI creation does not count.
export function recordSignIn(db, userId, eventType, now) {
  if (!['login', 'register'].includes(eventType)) throw new Error('Invalid sign-in event type');
  db.prepare('UPDATE users SET last_login_at=?,login_count=login_count+1 WHERE id=?').run(now, userId);
  db.prepare('INSERT INTO login_events(id,user_id,occurred_at,event_type) VALUES(?,?,?,?)').run(randomUUID(), userId, now, eventType);
  // Keep only the most recent audit rows. Per-user totals remain cumulative.
  db.prepare('DELETE FROM login_events WHERE id IN (SELECT id FROM login_events ORDER BY occurred_at DESC,rowid DESC LIMIT -1 OFFSET ?)').run(LOGIN_HISTORY_LIMIT);
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, HASH_OPTIONS);
  return `scrypt$32768$8$1$${salt}$${hash.toString('hex')}`;
}
export async function checkPassword(password, encoded) {
  const parts = String(encoded ?? '').split('$');
  const valid = parts.length === 6 && parts[0] === 'scrypt' && parts[1] === '32768' && parts[2] === '8' && parts[3] === '1' && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{128}$/.test(parts[5]);
  // Unknown accounts still incur the same password-derivation cost.
  const actual = await scrypt(password, valid ? parts[4] : '00000000000000000000000000000000', 64, HASH_OPTIONS);
  const expected = valid ? Buffer.from(parts[5], 'hex') : Buffer.alloc(64);
  return timingSafeEqual(actual, expected) && valid;
}

export async function provisionAdmin(db, { email, name, password }, { now = Date.now(), allowAdditional = false } = {}) {
  const normalizedEmail = validEmail(email);
  const normalizedName = plain(name, 'name', 2, 100);
  validPassword(password);
  if (!allowAdditional && db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()) fail(409, 'ADMIN_EXISTS', 'Admin đầu tiên đã tồn tại. Dùng --allow-additional trong CLI tin cậy nếu thực sự cần thêm admin.');
  if (db.prepare('SELECT id FROM users WHERE email=?').get(normalizedEmail)) fail(409, 'EMAIL_EXISTS', 'Email đã được sử dụng. CLI này chỉ tạo tài khoản mới.');
  const id = randomUUID();
  const hash = await hashPassword(password);
  db.prepare("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(id, normalizedEmail, normalizedName, hash, now);
  return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id));
}

export function readSession(req, db, now) {
  const cookies = String(req.headers.cookie ?? '').split(';').map(part => part.trim());
  const token = cookies.find(part => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token), now);
  if (!row) return null;
  const user = row.user_id ? db.prepare('SELECT id,email,name,role,email_verified_at,email_verification_required,auth_version FROM users WHERE id=?').get(row.user_id) : null;
  if (row.user_id && !user) return null;
  if (user && (Number(row.auth_version) !== Number(user.auth_version) || row.user_role !== user.role)) { db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); return null; }
  return { ...row, user: publicUser(user) };
}
export function createSession(res, db, { userId = null, previous = null, now, secureCookies }) {
  if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(previous.token_hash);
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  const maxAge = userId ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
  const expiresAt = now + maxAge * 1000;
  const tokenHash = digest(token);
  const user = userId ? db.prepare('SELECT * FROM users WHERE id=?').get(userId) : null;
  db.prepare('INSERT INTO sessions(token_hash,csrf_token,user_id,expires_at,created_at,auth_version,user_role) VALUES(?,?,?,?,?,?,?)').run(tokenHash, csrf, userId, expiresAt, now, user?.auth_version ?? 0, user?.role ?? null);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`);
  return { token_hash: tokenHash, csrf_token: csrf, user_id: userId, expires_at: expiresAt, user: publicUser(user) };
}
export function requireUser(session) { if (!session?.user) fail(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục.'); return session.user; }
export function requireAdmin(session) { const user = requireUser(session); if (user.role !== 'admin') fail(403, 'FORBIDDEN', 'Thao tác này chỉ dành cho admin.'); return user; }
export function verifyMutation(req, session, appOrigin) {
  if (req.headers.origin !== appOrigin || req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'ORIGIN_REJECTED', 'Nguồn yêu cầu không hợp lệ.');
  const token = req.headers['x-csrf-token'];
  if (!session || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf_token))) fail(403, 'CSRF_REJECTED', 'Phiên bảo vệ đã thay đổi. Vui lòng tải lại trang và thử lại.');
}
