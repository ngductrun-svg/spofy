-- Additive migration: existing users keep passwords, articles and access.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_required INTEGER NOT NULL DEFAULT 0 CHECK(email_verification_required IN (0,1));
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_role TEXT;
UPDATE sessions s SET user_role=u.role FROM users u WHERE s.user_id=u.id AND s.user_role IS NULL;
CREATE TABLE IF NOT EXISTS auth_tokens (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 created_at BIGINT NOT NULL,
 expires_at BIGINT NOT NULL,
 consumed_at BIGINT,
 delivery_state TEXT NOT NULL CHECK(delivery_state IN ('pending','sent'))
);
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens(user_id,purpose);
CREATE INDEX IF NOT EXISTS auth_tokens_expiry ON auth_tokens(expires_at);
CREATE OR REPLACE FUNCTION spofy_role_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role IS DISTINCT FROM OLD.role THEN
  NEW.auth_version := OLD.auth_version+1;
  DELETE FROM sessions WHERE user_id=OLD.id;
  UPDATE auth_tokens SET consumed_at=(extract(epoch FROM clock_timestamp())*1000)::BIGINT WHERE user_id=OLD.id AND consumed_at IS NULL;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS users_role_revokes_sessions ON users;
CREATE TRIGGER users_role_revokes_sessions BEFORE UPDATE OF role ON users FOR EACH ROW EXECUTE FUNCTION spofy_role_changed();
INSERT INTO schema_migrations(version,applied_at) VALUES(3,(extract(epoch FROM clock_timestamp())*1000)::BIGINT) ON CONFLICT DO NOTHING;
