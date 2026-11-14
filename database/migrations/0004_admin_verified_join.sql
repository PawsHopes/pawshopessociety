-- Paw's Hopez Society ERP
-- 0004: Admin-verified, reusable join links and applications.
-- Apply to staging only after reviewing and validating the migration.

PRAGMA foreign_keys = ON;

CREATE TABLE join_links (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE join_applications (
  id TEXT PRIMARY KEY,
  join_link_id TEXT NOT NULL REFERENCES join_links(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  rejection_reason TEXT,
  created_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR
    (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

-- A person may not submit multiple simultaneous pending applications using different links.
CREATE UNIQUE INDEX idx_join_applications_pending_email
ON join_applications(email COLLATE NOCASE)
WHERE status = 'pending';

CREATE INDEX idx_join_applications_status_date
ON join_applications(status, submitted_at DESC);

CREATE INDEX idx_join_applications_link
ON join_applications(join_link_id, submitted_at DESC);

CREATE INDEX idx_join_links_active_expiry
ON join_links(revoked_at, expires_at);
