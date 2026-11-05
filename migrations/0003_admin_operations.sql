-- Owner-only operational summaries. Never store attack request data or chat
-- transcripts. The enable timestamp makes the scope of every counter explicit.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_operation_metrics (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tracking_since TEXT NOT NULL,
  turnstile_blocked INTEGER NOT NULL DEFAULT 0 CHECK (turnstile_blocked >= 0),
  rate_limited INTEGER NOT NULL DEFAULT 0 CHECK (rate_limited >= 0),
  suspicious_requests INTEGER NOT NULL DEFAULT 0 CHECK (suspicious_requests >= 0),
  mail_sent INTEGER NOT NULL DEFAULT 0 CHECK (mail_sent >= 0),
  mail_failed INTEGER NOT NULL DEFAULT 0 CHECK (mail_failed >= 0),
  last_delivery_at TEXT,
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0)
);

INSERT OR IGNORE INTO admin_operation_metrics (id, tracking_since)
  VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE IF NOT EXISTS admin_contacts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ', 'REPLIED', 'ARCHIVED')),
  -- 'pending' is internal: a submission is saved before the external mail API.
  -- It remains distinguishable if a Worker is interrupted before completion.
  mail_status TEXT NOT NULL DEFAULT 'pending' CHECK (mail_status IN ('pending', 'sent', 'failed', 'unconfigured')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_contacts_created
  ON admin_contacts (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_contacts_status
  ON admin_contacts (status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS admin_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'ARCHIVED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_updated
  ON admin_tasks (updated_at DESC, id DESC);
