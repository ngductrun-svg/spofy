import { emitKeypressEvents } from 'node:readline';
import { openDatabase } from './db.mjs';
import { provisionAdmin } from './auth.mjs';
import { configuration } from './config.mjs';

function args() {
  const result = { allowAdditional: false };
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (key === '--allow-additional') result.allowAdditional = true;
    else if ((key === '--email' || key === '--name') && process.argv[i + 1]) result[key.slice(2)] = process.argv[++i];
    else throw new Error('Cú pháp: npm run admin:create -- --email admin@example.com --name "Tên admin" [--allow-additional]. Không truyền mật khẩu qua tham số.');
  }
  if (!result.email || !result.name) throw new Error('Cần --email và --name. Mật khẩu được nhập ẩn sau đó.');
  return result;
}
function hiddenPrompt(message) {
  return new Promise((resolve, reject) => {
    process.stdout.write(message); let value = '';
    emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
    function finish() { process.stdin.off('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); }
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === 'c') { finish(); reject(new Error('Đã hủy.')); }
      else if (key.name === 'return' || key.name === 'enter') { finish(); resolve(value); }
      else if (key.name === 'backspace') value = Array.from(value).slice(0, -1).join('');
      else if (!key.ctrl && !key.meta && text && !/[\u0000-\u001f\u007f]/u.test(text)) value += text;
    }
    process.stdin.on('keypress', onKey);
  });
}
let db;
try {
  const values = args(), config = configuration();
  let first, second;
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    first = await hiddenPrompt('Mật khẩu admin (12–128 ký tự, không hiển thị): ');
    second = await hiddenPrompt('Nhập lại mật khẩu: ');
  } else {
    let raw = ''; for await (const chunk of process.stdin) { raw += chunk.toString('utf8'); if (raw.length > 4096) throw new Error('Đầu vào quá dài.'); }
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    [first, second] = lines;
  }
  if (typeof first !== 'string' || first !== second) throw new Error('Hai mật khẩu chưa khớp.');
  db = openDatabase(config.dbPath);
  const user = await provisionAdmin(db, { email: values.email, name: values.name, password: first }, { allowAdditional: values.allowAdditional });
  console.log(`Đã tạo admin ${user.email}. Đăng nhập tại ${config.appOrigin}/dang-nhap. Không có cơ chế cấp quyền admin qua trình duyệt.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { db?.close(); }
