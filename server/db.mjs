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
  if (!db.prepare('SELECT version FROM schema_migrations WHERE version=3').get()) {
    transaction(db, () => {
      const users = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
      if (!users.has('email_verified_at')) db.exec('ALTER TABLE users ADD COLUMN email_verified_at INTEGER');
      if (!users.has('email_verification_required')) db.exec('ALTER TABLE users ADD COLUMN email_verification_required INTEGER NOT NULL DEFAULT 0 CHECK(email_verification_required IN (0,1))');
      if (!users.has('auth_version')) db.exec('ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0');
      const sessions = new Set(db.prepare('PRAGMA table_info(sessions)').all().map(column => column.name));
      if (!sessions.has('auth_version')) db.exec('ALTER TABLE sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0');
      if (!sessions.has('user_role')) db.exec('ALTER TABLE sessions ADD COLUMN user_role TEXT');
      db.exec('UPDATE sessions SET user_role=(SELECT role FROM users WHERE id=sessions.user_id) WHERE user_id IS NOT NULL');
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(3,?)').run(Date.now());
    });
  }
  db.exec(`CREATE TRIGGER IF NOT EXISTS users_role_revokes_sessions AFTER UPDATE OF role ON users WHEN OLD.role<>NEW.role BEGIN
    UPDATE users SET auth_version=auth_version+1 WHERE id=NEW.id;
    DELETE FROM sessions WHERE user_id=NEW.id;
    UPDATE auth_tokens SET consumed_at=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE user_id=NEW.id AND consumed_at IS NULL;
  END;`);
  return db;
}

export function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
