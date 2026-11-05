-- PHRNONO content-management schema.  Keep content metadata in D1 and the
-- binary files in R2; the Worker only exposes media that belongs to published
-- content.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('works', 'game-wall', 'music')),
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  cover_media_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (collection, slug)
);

CREATE INDEX IF NOT EXISTS idx_content_items_public_list
  ON content_items (collection, status, sort_order, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_items_admin_list
  ON content_items (collection, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_media (
  id TEXT PRIMARY KEY NOT NULL,
  content_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
  collection TEXT NOT NULL CHECK (collection IN ('works', 'game-wall', 'music')),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio')),
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  storage_key TEXT NOT NULL UNIQUE,
  alt_text TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_media_content
  ON content_media (content_id, visibility, created_at);

CREATE INDEX IF NOT EXISTS idx_content_media_collection
  ON content_media (collection, updated_at DESC);
