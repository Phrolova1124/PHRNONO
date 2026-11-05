-- Resumable R2 upload state.  File objects remain private in R2 until
-- completion creates a corresponding content_media row.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_upload_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  upload_id TEXT NOT NULL UNIQUE,
  content_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
  collection TEXT NOT NULL CHECK (collection IN ('works', 'game-wall', 'music')),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio')),
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  part_size INTEGER NOT NULL CHECK (part_size >= 5242880),
  part_count INTEGER NOT NULL CHECK (part_count >= 2 AND part_count <= 10000),
  storage_key TEXT NOT NULL UNIQUE,
  alt_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted', 'expired', 'failed')),
  -- Pending uploads reserve capacity before any bytes become a content_media
  -- object, preventing parallel starts from silently ignoring the 8 GiB cap.
  reserved_bytes INTEGER NOT NULL CHECK (reserved_bytes >= 0),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_upload_sessions_capacity
  ON content_upload_sessions (status, expires_at, reserved_bytes);

CREATE INDEX IF NOT EXISTS idx_content_upload_sessions_content
  ON content_upload_sessions (collection, content_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_upload_parts (
  session_id TEXT NOT NULL REFERENCES content_upload_sessions(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK (part_number >= 1 AND part_number <= 10000),
  etag TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, part_number)
);

CREATE INDEX IF NOT EXISTS idx_content_upload_parts_session
  ON content_upload_parts (session_id, part_number);
