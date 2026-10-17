import { backup } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { openDatabase } from './db.mjs';
import { configuration } from './config.mjs';

// SQLite's backup API includes committed WAL data. Media must be backed up separately.
let db;
try {
  const config = configuration();
  const destination = process.argv[2];
  if (!destination) throw new Error('Cú pháp: node server/backup.mjs <đường-dẫn-bản-sao.sqlite>. Sao lưu thư mục media riêng.');
  const target = resolve(destination);
  if (target === resolve(config.dbPath)) throw new Error('Tệp đích phải khác cơ sở dữ liệu đang dùng.');
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  db = openDatabase(config.dbPath); await backup(db, target);
  console.log(`Đã sao lưu SQLite đến ${target}.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { db?.close(); }
