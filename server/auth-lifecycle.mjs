import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fail } from './errors.mjs';
import { email, password, plain } from './validation.mjs';
import { digest, hashPassword } from './auth.mjs';

const HOUR = 3_600_000;
export const AUTH_TOKEN_RETENTION_MS = 48 * HOUR;
export const REGISTRATION_MESSAGE = 'Yêu cầu đã được tiếp nhận. Nếu thông tin phù hợp và dịch vụ email hoạt động, liên kết xác minh sẽ được gửi. Website không xác nhận email có tài khoản hay thư đã đến hộp thư. Vui lòng kiểm tra cả thư rác.';
export const RESET_MESSAGE = 'Yêu cầu đã được tiếp nhận. Nếu thông tin phù hợp và dịch vụ email hoạt động, liên kết đặt lại mật khẩu sẽ được gửi. Website không xác nhận email có tài khoản hay thư đã đến hộp thư. Vui lòng kiểm tra cả thư rác.';
const weak = new Set(['password1234', 'password12345', 'password123456', '123456789012', '1234567890123', '12345678901234', '123456789012345', '1234567890123456', 'qwerty123456', 'qwertyuiop123', 'qwertyuiop123456', 'iloveyou12345', 'admin12345678', 'letmein123456', 'welcome123456', 'spofy12345678', 'matkhau123456', '111111111111', '000000000000']);

export async function validateNewPassword(value, { mode = 'local-blocklist', fetcher = fetch } = {}) {
  password(value);
  const normalized = value.toLowerCase().replace(/\s/g, '');
  if (weak.has(normalized) || /^(.)\1{11,}$/u.test(normalized) || /^(?:password|matkhau|qwerty|admin|welcome|spofy)[\d!@#$%^&*._-]*$/u.test(normalized)) fail(422, 'WEAK_PASSWORD', 'Mật khẩu quá phổ biến. Hãy dùng một cụm từ dài, riêng biệt.', { password: 'Hãy chọn mật khẩu khó đoán hơn.' });
  if (mode !== 'hibp') return;
  // Only five SHA-1 prefix characters leave the server; passwords and full hashes never do.
  const hash = createHash('sha1').update(value).digest('hex').toUpperCase();
  let response, body;
  try {
    response = await fetcher(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { 'Add-Padding': 'true', 'User-Agent': 'SPOFY-password-check' }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Password service unavailable');
    body = await response.text();
    const lines = body.split(/\r?\n/).filter(Boolean);
    if (!lines.length || body.length > 2_000_000 || !lines.every(line => /^[A-F0-9]{35}:\d+$/i.test(line))) throw new Error('Invalid password service response');
  } catch { fail(503, 'PASSWORD_CHECK_UNAVAILABLE', 'Chưa kiểm tra được mật khẩu rò rỉ. Vui lòng thử lại sau.'); }
  if (body.split(/\r?\n/).some(line => { const [suffix, count] = line.split(':'); return suffix?.toUpperCase() === hash.slice(5) && Number(count) > 0; })) fail(422, 'BREACHED_PASSWORD', 'Mật khẩu này từng xuất hiện trong dữ liệu rò rỉ. Vui lòng chọn mật khẩu khác.', { password: 'Hãy dùng mật khẩu chưa từng sử dụng ở nơi khác.' });
}

const validMailbox = value => typeof value === 'string' && value.length <= 254 && /^[^\s@<>,;\x00-\x1f\x7f]+@[^\s@<>,;\x00-\x1f\x7f]+\.[^\s@<>,;\x00-\x1f\x7f]+$/u.test(value);
function mailSender(value) {
  if (typeof value !== 'string' || value.length > 400 || /[\x00-\x1f\x7f]/u.test(value)) return null;
  const from = value.trim();
  if (validMailbox(from)) return { email: from, name: 'SPOFY' };
  const match = /^([^<>]+)\s*<([^<>]+)>$/u.exec(from);
  if (!match) return null;
  let name = match[1].trim();
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).trim();
  const address = match[2].trim();
  return name && name.length <= 120 && !/[",;]/u.test(name) && validMailbox(address) ? { email: address, name } : null;
}

export function createEmailService({ env = {}, fetcher = fetch, transport, appOrigin, cloud = false } = {}) {
  let origin;
  try {
    const value = new URL(env.APP_ORIGIN || appOrigin || '');
    if (value.pathname !== '/' || value.search || value.hash || value.username || value.password || (cloud ? value.protocol !== 'https:' : !['http:', 'https:'].includes(value.protocol))) throw new Error();
    origin = value.origin;
  } catch { origin = null; }
  const preview = env.CONTEXT && env.CONTEXT !== 'production';
  const provider = typeof env.MAIL_PROVIDER === 'string' ? env.MAIL_PROVIDER.trim().toLowerCase() || 'resend' : env.MAIL_PROVIDER == null ? 'resend' : null;
  const supported = provider === 'resend' || provider === 'brevo';
  const apiKey = supported ? env[provider === 'brevo' ? 'BREVO_API_KEY' : 'RESEND_API_KEY'] : null;
  const sender = mailSender(env.MAIL_FROM);
  const testRecipient = validMailbox(env.MAIL_TEST_RECIPIENT) ? env.MAIL_TEST_RECIPIENT : null;
  const hasKey = typeof apiKey === 'string' && Boolean(apiKey.trim()) && !/[\r\n]/u.test(apiKey);
  // Test transports never connect to a provider; actual Preview mail is always
  // redirected to the one owner-controlled mailbox, regardless of provider.
  const configured = Boolean(origin && supported && (transport || (hasKey && sender && (!preview || (env.MAIL_MODE === 'test' && testRecipient)))));
  return {
    configured,
    assertConfigured() { if (!configured) fail(503, 'MAIL_NOT_CONFIGURED', 'Chức năng email chưa được cấu hình. Bạn vẫn có thể đọc bài và đăng nhập tài khoản hiện có.'); },
    async send({ to, purpose, token }) {
      this.assertConfigured();
      const reset = purpose === 'reset', url = `${origin}/${reset ? 'dat-lai-mat-khau' : 'xac-minh-email'}#token=${token}`;
      const subject = reset ? 'SPOFY — Đặt lại mật khẩu' : 'SPOFY — Xác minh địa chỉ email';
      const text = `${reset ? 'Bạn vừa yêu cầu đặt lại mật khẩu SPOFY.' : 'Cảm ơn bạn đã đăng ký SPOFY. Xác minh email để tham gia bình luận.'}\n\n${url}\n\nLiên kết dùng một lần, có hiệu lực ${reset ? '30 phút' : '24 giờ'}. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;
      try {
        const message = { from: env.MAIL_FROM, to: preview && !transport ? testRecipient : to, subject, text };
        if (transport) await transport(message);
        else {
          if (!validMailbox(message.to)) throw new Error('Invalid mail recipient');
          const brevo = provider === 'brevo';
          const endpoint = brevo ? 'https://api.brevo.com/v3/smtp/email' : 'https://api.resend.com/emails';
          const headers = { 'Content-Type': 'application/json', ...(brevo ? { 'api-key': apiKey } : { Authorization: `Bearer ${apiKey}` }) };
          const body = brevo ? { sender, to: [{ email: message.to }], subject, textContent: text } : message;
          const response = await fetcher(endpoint, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(10_000) });
          if (!response.ok) throw new Error('Mail service unavailable');
          const result = await response.json();
          const messageId = brevo ? result.messageId : result.id;
          if (typeof messageId !== 'string' || !messageId.trim()) throw new Error('Mail service did not accept the message');
        }
      } catch { fail(503, 'MAIL_DELIVERY_FAILED', 'Chưa gửi được email. Vui lòng thử lại sau; yêu cầu này chưa được xác nhận thành công.'); }
    },
  };
}

// Both production PostgreSQL and local SQLite expose this tiny query/transaction
// contract. No secret, email body or bearer token is persisted in the database.
export function createAuthLifecycle({ db, mail, now = Date.now, passwordOptions = {}, logger = console }) {
  const first = async (connection, sql, args = []) => (await connection.query(sql, args)).rows[0];
  async function deliver(user, purpose) {
    const token = randomBytes(32).toString('hex'), tokenHash = digest(token), time = now();
    await db.query("INSERT INTO auth_tokens(token_hash,user_id,purpose,created_at,expires_at,delivery_state) VALUES($1,$2,$3,$4,$5,'pending')", [tokenHash, user.id, purpose, time, time + (purpose === 'reset' ? HOUR / 2 : 24 * HOUR)]);
    try { await mail.send({ to: user.email, purpose, token }); }
    catch (error) { await db.query('DELETE FROM auth_tokens WHERE token_hash=$1', [tokenHash]); throw error; }
    await db.transaction(async connection => {
      await first(connection, 'SELECT id FROM users WHERE id=$1' + (db.postgres ? ' FOR UPDATE' : ''), [user.id]);
      await connection.query('UPDATE auth_tokens SET consumed_at=$1 WHERE user_id=$2 AND purpose=$3 AND token_hash<>$4 AND consumed_at IS NULL', [now(), user.id, purpose, tokenHash]);
      await connection.query("UPDATE auth_tokens SET delivery_state='sent' WHERE token_hash=$1", [tokenHash]);
    });
  }
  function tokenValue(value) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(400, 'INVALID_AUTH_TOKEN', 'Liên kết không hợp lệ, đã dùng hoặc đã hết hạn.'); return digest(value); }
  async function consume(token, purpose, work) {
    const tokenHash = tokenValue(token), time = now();
    return db.transaction(async connection => {
      const row = await first(connection, "UPDATE auth_tokens SET consumed_at=$1 WHERE token_hash=$2 AND purpose=$3 AND consumed_at IS NULL AND expires_at>$1 AND delivery_state='sent' RETURNING user_id", [time, tokenHash, purpose]);
      if (!row) fail(400, 'INVALID_AUTH_TOKEN', 'Liên kết không hợp lệ, đã dùng hoặc đã hết hạn.');
      return work(connection, row.user_id, time);
    });
  }
  return {
    capabilities: { emailConfigured: mail.configured, verificationRequired: true, passwordBreachCheck: passwordOptions.mode === 'hibp' ? 'hibp' : 'local-blocklist' },
    async register(body) {
      const normalizedEmail = email(body.email), name = plain(body.name, 'name', 2, 100);
      mail.assertConfigured();
      await validateNewPassword(body.password, passwordOptions);
      const hash = await hashPassword(body.password), time = now(), id = randomUUID();
      const result = await db.query("INSERT INTO users(id,email,name,password_hash,role,created_at,email_verification_required) VALUES($1,$2,$3,$4,'reader',$5,1) ON CONFLICT(email) DO NOTHING RETURNING id,email", [id, normalizedEmail, name, hash, time]);
      // Existing accounts get the identical public response and are never overwritten.
      if (result.rows[0]) {
        try { await deliver(result.rows[0], 'verify'); }
        catch (error) {
          // A failed first delivery may be retried from registration. Never
          // remove an account that has already been used or edited meanwhile.
          await db.query("DELETE FROM users WHERE id=$1 AND email_verified_at IS NULL AND last_login_at IS NULL AND role='reader' AND email_verification_required=1", [id]);
          if (error?.code !== 'MAIL_DELIVERY_FAILED') throw error;
          // Public endpoints cannot reveal whether a recipient/account exists
          // through a provider-specific delivery error. This acknowledges the
          // request only; it deliberately does not claim an email was delivered.
          logger.warn('SPOFY auth mail: MAIL_DELIVERY_FAILED');
        }
      }
      return { message: REGISTRATION_MESSAGE };
    },
    async forgot(value) {
      const normalizedEmail = email(value); mail.assertConfigured();
      const user = await first(db, 'SELECT id,email FROM users WHERE email=$1', [normalizedEmail]);
      if (user) {
        try { await deliver(user, 'reset'); }
        catch (error) { if (error?.code !== 'MAIL_DELIVERY_FAILED') throw error; logger.warn('SPOFY auth mail: MAIL_DELIVERY_FAILED'); }
      }
      return { message: RESET_MESSAGE };
    },
    async resend(userId) {
      mail.assertConfigured();
      const user = await first(db, 'SELECT id,email,email_verified_at FROM users WHERE id=$1', [userId]);
      if (user && user.email_verified_at == null) await deliver(user, 'verify');
      return { message: 'Nếu email cần xác minh, hướng dẫn mới đã được gửi. Vui lòng kiểm tra cả thư rác.' };
    },
    async verify(token) {
      return consume(token, 'verify', async (connection, userId, time) => {
        await connection.query('UPDATE users SET email_verified_at=$1 WHERE id=$2', [time, userId]);
        await connection.query("UPDATE auth_tokens SET consumed_at=$1 WHERE user_id=$2 AND purpose='verify' AND consumed_at IS NULL", [time, userId]);
        return userId;
      });
    },
    async reset(token, value) {
      tokenValue(token);
      await validateNewPassword(value, passwordOptions);
      const hash = await hashPassword(value);
      await consume(token, 'reset', async (connection, userId, time) => {
        await connection.query('UPDATE users SET password_hash=$1,auth_version=auth_version+1 WHERE id=$2', [hash, userId]);
        await connection.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
        await connection.query('UPDATE auth_tokens SET consumed_at=$1 WHERE user_id=$2 AND consumed_at IS NULL', [time, userId]);
      });
      return { ok: true, message: 'Đã đổi mật khẩu và đăng xuất các phiên cũ. Vui lòng đăng nhập lại.' };
    },
  };
}

export function sqliteAuthAdapter(database) {
  let queue = Promise.resolve();
  function query(sql, parameters = []) {
    const args = [], statement = database.prepare(sql.replace(/\$(\d+)/g, (_, index) => { args.push(parameters[Number(index) - 1]); return '?'; }));
    if (/^\s*SELECT\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) return { rows: statement.all(...args) };
    return { rows: [], rowCount: statement.run(...args).changes };
  }
  return { query, transaction(work) {
    const run = queue.then(async () => {
      database.exec('BEGIN IMMEDIATE');
      try { const result = await work({ query }); database.exec('COMMIT'); return result; }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    });
    queue = run.catch(() => {});
    return run;
  } };
}
