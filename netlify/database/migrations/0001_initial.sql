CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader','admin')),
 created_at BIGINT NOT NULL,
 last_login_at BIGINT,
 login_count INTEGER NOT NULL DEFAULT 0 CHECK(login_count>=0)
);
CREATE TABLE IF NOT EXISTS login_events (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 occurred_at BIGINT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('login','register'))
);
CREATE INDEX IF NOT EXISTS login_events_recent ON login_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS login_events_user ON login_events(user_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 csrf_token TEXT NOT NULL,
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 expires_at BIGINT NOT NULL,
 created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
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
 published_at BIGINT,
 created_at BIGINT NOT NULL,
 updated_at BIGINT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id)
);
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
 created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS article_media (
 article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
 media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 PRIMARY KEY(article_id,media_id)
);
CREATE INDEX IF NOT EXISTS media_article ON article_media(media_id,article_id);
CREATE TABLE IF NOT EXISTS comments (
 id TEXT PRIMARY KEY,
 article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL,
 body_fingerprint TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden')),
 created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_article ON comments(article_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS comments_duplicate ON comments(user_id,body_fingerprint,created_at);
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY,
 window_start BIGINT NOT NULL,
 count INTEGER NOT NULL
);

-- Accent-insensitive search without a privileged PostgreSQL extension.
CREATE OR REPLACE FUNCTION spofy_fold(input TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT lower(translate(regexp_replace(normalize(input, NFD), U&'[\0300-\036F]', '', 'g'), 'đĐ', 'dD'))
$$;
INSERT INTO schema_migrations(version,applied_at) VALUES
 (1, (extract(epoch from clock_timestamp()) * 1000)::BIGINT),
 (2, (extract(epoch from clock_timestamp()) * 1000)::BIGINT)
 ON CONFLICT(version) DO NOTHING;
