PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader','admin')),
 created_at INTEGER NOT NULL,
 last_login_at INTEGER,
 login_count INTEGER NOT NULL DEFAULT 0 CHECK(login_count>=0),
 email_verified_at INTEGER,
 email_verification_required INTEGER NOT NULL DEFAULT 0 CHECK(email_verification_required IN (0,1)),
 auth_version INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE TABLE IF NOT EXISTS login_events (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 occurred_at INTEGER NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('login','register'))
) STRICT;
CREATE INDEX IF NOT EXISTS login_events_recent ON login_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS login_events_user ON login_events(user_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 csrf_token TEXT NOT NULL,
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 auth_version INTEGER NOT NULL DEFAULT 0,
 user_role TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_tokens (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 delivery_state TEXT NOT NULL CHECK(delivery_state IN ('pending','sent'))
) STRICT;
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens(user_id,purpose);
CREATE INDEX IF NOT EXISTS auth_tokens_expiry ON auth_tokens(expires_at);
CREATE TABLE IF NOT EXISTS articles (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 slug TEXT NOT NULL UNIQUE,
 summary TEXT NOT NULL DEFAULT '',
 cover_image TEXT NOT NULL DEFAULT '',
 cover_alt TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL CHECK(category IN ('toan-hoc','vat-li','hoa-hoc','sinh-hoc','cong-nghe','stem')),
 tags_json TEXT NOT NULL DEFAULT '[]',
 author TEXT NOT NULL,
 blocks_json TEXT NOT NULL DEFAULT '[]',
 references_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
 search_text TEXT NOT NULL DEFAULT '',
 published_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id)
) STRICT;
CREATE INDEX IF NOT EXISTS articles_public_list ON articles(status,published_at DESC);
CREATE INDEX IF NOT EXISTS articles_category ON articles(category,status,published_at DESC);
CREATE TABLE IF NOT EXISTS media (
 id TEXT PRIMARY KEY,
 filename TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,
 size INTEGER NOT NULL,
 width INTEGER NOT NULL,
 height INTEGER NOT NULL,
 uploaded_by TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS article_media (
 article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
 media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 PRIMARY KEY(article_id,media_id)
) STRICT;
CREATE INDEX IF NOT EXISTS media_article ON article_media(media_id,article_id);
CREATE TABLE IF NOT EXISTS comments (
 id TEXT PRIMARY KEY,
 article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL,
 body_fingerprint TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden')),
 created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS comments_article ON comments(article_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS comments_duplicate ON comments(user_id,body_fingerprint,created_at);
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY,
 window_start INTEGER NOT NULL,
 count INTEGER NOT NULL
) STRICT;
