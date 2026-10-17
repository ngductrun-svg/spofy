import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,?)').run(Date.now());
  // Existing installations keep their users, passwords, posts and sessions. Old
  // sign-ins were never recorded, so they deliberately remain unknown (null/0).
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version=2').get()) {
    transaction(db, () => {
      const columns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
      if (!columns.has('last_login_at')) db.exec('ALTER TABLE users ADD COLUMN last_login_at INTEGER');
      if (!columns.has('login_count')) db.exec('ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0 CHECK(login_count>=0)');
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(2,?)').run(Date.now());
    });
  }
  return db;
}

export function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
