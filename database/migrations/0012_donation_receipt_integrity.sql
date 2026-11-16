-- ============================================================================
-- 0012: IMMUTABLE DONATION RECEIPTS WITH VERIFIED-DONATION REQUIREMENT
-- ============================================================================

CREATE TABLE donation_receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  donation_id TEXT NOT NULL UNIQUE REFERENCES donations(id) ON DELETE RESTRICT,
  issued_date TEXT NOT NULL,
  is_80g_eligible INTEGER NOT NULL DEFAULT 0 CHECK (is_80g_eligible IN (0, 1)),
  pdf_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  issued_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER trg_donation_receipt_requires_verified_donation
BEFORE INSERT ON donation_receipts
WHEN NOT EXISTS (
  SELECT 1 FROM donations
  WHERE id = NEW.donation_id AND verification_status = 'verified'
)
  OR NEW.is_80g_eligible <> 0
BEGIN
  SELECT RAISE(ABORT, 'Donation receipts require a verified donation and cannot claim 80G eligibility before approval');
END;

CREATE TRIGGER trg_donation_receipts_immutable_update
BEFORE UPDATE ON donation_receipts
BEGIN
  SELECT RAISE(ABORT, 'Donation receipts are immutable');
END;

CREATE TRIGGER trg_donation_receipts_immutable_delete
BEFORE DELETE ON donation_receipts
BEGIN
  SELECT RAISE(ABORT, 'Donation receipts are immutable');
END;
