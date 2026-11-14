
-- Paw's Hopez Society ERP
-- Security hardening migration 0003
-- Apply only after reviewing staging migration history.

-- Prevent demotion or suspension of the last active Super Admin.
CREATE TRIGGER IF NOT EXISTS trg_keep_one_active_super_admin
BEFORE UPDATE OF role_id, status ON users
WHEN OLD.status = 'active'
 AND OLD.role_id = (SELECT id FROM roles WHERE code = 'super_admin')
 AND (
   NEW.status != 'active'
   OR NEW.role_id != OLD.role_id
 )
 AND (
   SELECT COUNT(*)
   FROM users
   WHERE status = 'active'
     AND role_id = (SELECT id FROM roles WHERE code = 'super_admin')
 ) <= 1
BEGIN
  SELECT RAISE(
    ABORT,
    'Cannot demote or suspend the last active Super Admin'
  );
END;

-- Prevent deleting the last active Super Admin.
CREATE TRIGGER IF NOT EXISTS trg_keep_one_active_super_admin_on_delete
BEFORE DELETE ON users
WHEN OLD.status = 'active'
 AND OLD.role_id = (SELECT id FROM roles WHERE code = 'super_admin')
 AND (
   SELECT COUNT(*)
   FROM users
   WHERE status = 'active'
     AND role_id = (SELECT id FROM roles WHERE code = 'super_admin')
 ) <= 1
BEGIN
  SELECT RAISE(
    ABORT,
    'Cannot delete the last active Super Admin'
  );
END;

-- Verified donations must not be edited or deleted.
DROP TRIGGER IF EXISTS trg_verified_donation_immutable;

CREATE TRIGGER trg_verified_donation_immutable
BEFORE UPDATE ON donations
WHEN OLD.verification_status IN ('verified', 'refunded')
BEGIN
  SELECT RAISE(
    ABORT,
    'Verified donations are immutable. Use a separate reversal entry.'
  );
END;

DROP TRIGGER IF EXISTS trg_verified_donation_no_delete;

CREATE TRIGGER trg_verified_donation_no_delete
BEFORE DELETE ON donations
WHEN OLD.verification_status IN ('verified', 'refunded')
BEGIN
  SELECT RAISE(
    ABORT,
    'Verified donations cannot be deleted.'
  );
END;

-- Approved expenses cannot have their original financial details changed.
-- The only permitted update is unpaid -> paid.
DROP TRIGGER IF EXISTS trg_approved_expense_immutable;

CREATE TRIGGER trg_approved_expense_immutable
BEFORE UPDATE ON expenses
WHEN OLD.approval_status = 'approved'
 AND (
   NEW.id IS NOT OLD.id
   OR NEW.expense_code IS NOT OLD.expense_code
   OR NEW.expense_date IS NOT OLD.expense_date
   OR NEW.category IS NOT OLD.category
   OR NEW.fund_category_id IS NOT OLD.fund_category_id
   OR NEW.account_id IS NOT OLD.account_id
   OR NEW.description IS NOT OLD.description
   OR NEW.amount_paise IS NOT OLD.amount_paise
   OR NEW.payment_mode IS NOT OLD.payment_mode
   OR NEW.vendor_payee IS NOT OLD.vendor_payee
   OR NEW.animal_id IS NOT OLD.animal_id
   OR NEW.rescue_case_id IS NOT OLD.rescue_case_id
   OR NEW.invoice_doc_id IS NOT OLD.invoice_doc_id
   OR NEW.submitted_by IS NOT OLD.submitted_by
   OR NEW.approval_status IS NOT OLD.approval_status
   OR NEW.approved_by IS NOT OLD.approved_by
   OR NEW.approved_at IS NOT OLD.approved_at
   OR NEW.created_at IS NOT OLD.created_at
   OR (
     OLD.payment_status = 'paid'
     AND NEW.payment_status != 'paid'
   )
 )
BEGIN
  SELECT RAISE(
    ABORT,
    'Approved expenses are immutable. Only unpaid-to-paid settlement is allowed.'
  );
END;

DROP TRIGGER IF EXISTS trg_approved_expense_no_delete;

CREATE TRIGGER trg_approved_expense_no_delete
BEFORE DELETE ON expenses
WHEN OLD.approval_status = 'approved'
BEGIN
  SELECT RAISE(
    ABORT,
    'Approved expenses cannot be deleted.'
  );
END;
