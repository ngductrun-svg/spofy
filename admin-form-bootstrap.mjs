// Trusted, local first-admin helper. This self-contained module is also embedded
// in the Windows form launcher. Credentials travel only through standard input.
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const INPUT_LIMIT = 16 * 1024;
const REQUIRED_FIELDS = ['projectDir', 'name', 'email', 'password', 'confirmPassword'];
const INPUT_FIELDS = new Set([...REQUIRED_FIELDS, 'mode']);
const KNOWN_ERRORS = Object.freeze({
  ADMIN_EXISTS: 'Thư mục này đã có admin. Hãy đăng nhập bằng tài khoản admin đã tạo; công cụ không thay đổi hoặc tạo thêm admin.',
  EMAIL_EXISTS: 'Email này đã đăng ký SPOFY. Hãy đánh dấu lựa chọn tài khoản đã có, rồi nhập đúng mật khẩu SPOFY để cấp quyền admin đầu tiên.',
  VALIDATION: 'Tên, email hoặc mật khẩu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.',
});

class HelperError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function invalid(message) { throw new HelperError('INVALID_INPUT', message); }

async function readInput() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
    size += bytes.length;
    if (size > INPUT_LIMIT) invalid('Dữ liệu quá dài. Vui lòng đóng công cụ và thử lại.');
    chunks.push(bytes);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { invalid('Không đọc được thông tin từ biểu mẫu. Vui lòng mở lại công cụ.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !INPUT_FIELDS.has(key))
    || REQUIRED_FIELDS.some(key => typeof value[key] !== 'string')
    || (value.mode !== undefined && !['create', 'existing'].includes(value.mode))) {
    invalid('Thông tin biểu mẫu không hợp lệ. Vui lòng mở lại công cụ.');
  }
  if (!value.projectDir || !isAbsolute(value.projectDir)) invalid('Vui lòng chọn thư mục SPOFY đã giải nén.');
  const mode = value.mode ?? 'create';
  const name = value.name.normalize('NFC').trim();
  if (mode === 'create' && (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/u.test(name))) invalid('Tên admin cần từ 2 đến 100 ký tự hợp lệ.');
  const email = value.email.normalize('NFC').trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) invalid('Vui lòng nhập địa chỉ email hợp lệ.');
  if (value.password.length < 12 || value.password.length > 128 || Buffer.byteLength(value.password, 'utf8') > 512) {
    invalid('Mật khẩu cần từ 12 đến 128 ký tự.');
  }
  if (value.password !== value.confirmPassword) {
    throw new HelperError('PASSWORD_MISMATCH', 'Hai mật khẩu chưa giống nhau. Vui lòng nhập lại.');
  }
  return { ...value, mode, name, email };
}

async function checkProject(projectDir) {
  try {
    const root = await realpath(projectDir);
    if (!(await stat(root)).isDirectory()) throw new Error('invalid');
    const packagePath = join(root, 'package.json');
    if ((await stat(packagePath)).size > 64 * 1024) throw new Error('invalid');
    const metadata = JSON.parse(await readFile(packagePath, 'utf8'));
    if (metadata.name !== 'spofy-science') throw new Error('invalid');
    for (const filename of ['config.mjs', 'db.mjs', 'auth.mjs']) {
      if (!(await stat(join(root, 'server', filename))).isFile()) throw new Error('invalid');
    }
    return root;
  } catch {
    throw new HelperError('PROJECT_INVALID', 'Chưa chọn đúng thư mục SPOFY. Hãy chọn thư mục đã giải nén chứa CHAY-SPOFY.cmd và thư mục server.');
  }
}

let db;
let transactionOpen = false;
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 15)) {
    throw new HelperError('NODE_VERSION', 'Cần Node.js 24.15 trở lên. Vui lòng cài Node.js 24 rồi mở lại công cụ.');
  }
  const input = await readInput();
  const projectDir = await checkProject(input.projectDir);
  const load = filename => import(pathToFileURL(join(projectDir, 'server', filename)).href);
  let configuration, openDatabase, provisionAdmin, checkPassword;
  try {
    [{ configuration }, { openDatabase }, { provisionAdmin, checkPassword }] = await Promise.all([
      load('config.mjs'), load('db.mjs'), load('auth.mjs'),
    ]);
    if (![configuration, openDatabase, provisionAdmin, checkPassword].every(value => typeof value === 'function')) throw new Error('invalid');
  } catch {
    throw new HelperError('PROJECT_INVALID', 'Không đọc được mã nguồn SPOFY. Hãy chọn đúng thư mục đã giải nén đầy đủ.');
  }
  let config, loginUrl;
  try {
    config = configuration();
    if (typeof config.dbPath !== 'string' || !isAbsolute(config.dbPath)) throw new Error('invalid');
    loginUrl = new URL('/dang-nhap?next=%2Fadmin', config.appOrigin).href;
  } catch {
    throw new HelperError('CONFIG_INVALID', 'Cấu hình .env của thư mục SPOFY chưa hợp lệ. Vui lòng kiểm tra cấu hình trước khi tạo admin.');
  }
  db = openDatabase(config.dbPath);
  let verifiedReader;
  if (input.mode === 'existing') {
    if (db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()) throw new HelperError('ADMIN_EXISTS', KNOWN_ERRORS.ADMIN_EXISTS);
    verifiedReader = db.prepare('SELECT id,email,password_hash,role FROM users WHERE email=?').get(input.email);
    const valid = await checkPassword(input.password, verifiedReader?.password_hash);
    if (!valid || verifiedReader?.role !== 'reader') {
      throw new HelperError('AUTH_INVALID', 'Email hoặc mật khẩu tài khoản SPOFY chưa đúng. Không có tài khoản nào bị thay đổi.');
    }
  }
  // Serialize the trusted helper's first-admin check and write. Existing-reader
  // promotion requires an explicit form choice and the account's own password.
  db.exec('BEGIN IMMEDIATE');
  transactionOpen = true;
  let user, action;
  if (input.mode === 'existing') {
    if (db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()) throw new HelperError('ADMIN_EXISTS', KNOWN_ERRORS.ADMIN_EXISTS);
    const current = db.prepare('SELECT id,email,password_hash,role FROM users WHERE id=?').get(verifiedReader.id);
    if (!current || current.role !== 'reader' || current.password_hash !== verifiedReader.password_hash) {
      throw new HelperError('AUTH_INVALID', 'Tài khoản đã thay đổi. Vui lòng kiểm tra thông tin và thử lại.');
    }
    db.prepare("UPDATE users SET role='admin' WHERE id=? AND role='reader'").run(current.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(current.id);
    user = current;
    action = 'promoted';
  } else {
    user = await provisionAdmin(db, input);
    action = 'created';
  }
  db.exec('COMMIT');
  transactionOpen = false;
  process.stdout.write(`${JSON.stringify({ ok: true, action, email: user.email, projectDir, dbPath: config.dbPath, loginUrl })}\n`);
} catch (error) {
  if (transactionOpen) { try { db.exec('ROLLBACK'); } catch {} transactionOpen = false; }
  const known = typeof error?.code === 'string' && Object.hasOwn(KNOWN_ERRORS, error.code);
  const code = error instanceof HelperError || known ? error.code : 'ADMIN_CREATE_FAILED';
  const message = error instanceof HelperError ? error.message : known ? KNOWN_ERRORS[error.code]
    : 'Không thể tạo admin. Kiểm tra quyền ghi thư mục và bảo đảm đã chọn đúng bản SPOFY, rồi thử lại.';
  process.stdout.write(`${JSON.stringify({ ok: false, code, message })}\n`);
  process.exitCode = 1;
} finally {
  try { db?.close(); } catch {}
}
