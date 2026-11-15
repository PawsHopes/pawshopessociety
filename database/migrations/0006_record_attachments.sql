-- Reusable, auditable file attachments for ERP records.
-- File bytes remain in R2; D1 stores only the relationship and metadata.
CREATE TABLE record_attachments (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  record_id TEXT NOT NULL,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  label TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (
    (media_asset_id IS NOT NULL AND document_id IS NULL) OR
    (media_asset_id IS NULL AND document_id IS NOT NULL)
  )
);

CREATE INDEX idx_record_attachments_record
ON record_attachments(resource, record_id, created_at);
