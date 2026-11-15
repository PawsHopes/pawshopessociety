-- Paws Hopes Society ERP
-- 0009: Track Cloudflare Access synchronisation for approved join applications.
-- Additive-only migration; does not alter existing user or application records.

ALTER TABLE join_applications
  ADD COLUMN access_sync_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (access_sync_status IN ('not_required', 'pending', 'synced', 'failed'));

ALTER TABLE join_applications
  ADD COLUMN access_synced_at TEXT;

ALTER TABLE join_applications
  ADD COLUMN access_sync_error TEXT;

UPDATE join_applications
SET access_sync_status = 'pending'
WHERE status = 'approved' AND created_user_id IS NOT NULL;

CREATE INDEX idx_join_applications_access_sync
ON join_applications(access_sync_status, reviewed_at DESC);
