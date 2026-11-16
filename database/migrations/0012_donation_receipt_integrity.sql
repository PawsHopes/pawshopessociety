-- ============================================================================
-- 0012: IMMUTABLE DONATION RECEIPTS WITH VERIFIED-DONATION REQUIREMENT
-- ============================================================================

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
