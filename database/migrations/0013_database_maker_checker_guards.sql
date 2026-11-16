-- ============================================================================
-- 0013: DATABASE-LEVEL MAKER-CHECKER AND STOCK INTEGRITY GUARDS
-- ============================================================================

ALTER TABLE stock_movements ADD COLUMN review_notes TEXT;

CREATE TRIGGER trg_expense_must_start_pending
BEFORE INSERT ON expenses
WHEN NEW.approval_status <> 'pending' OR NEW.approved_by IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Expense claims must be submitted pending approval.');
END;

CREATE TRIGGER trg_expense_requires_independent_approver
BEFORE UPDATE OF approval_status, approved_by ON expenses
WHEN OLD.approval_status = 'pending'
 AND NEW.approval_status = 'approved'
 AND (NEW.approved_by IS NULL OR NEW.approved_by = NEW.submitted_by)
BEGIN
  SELECT RAISE(ABORT, 'Expense claims must be approved by a different user than the submitter.');
END;

CREATE TRIGGER trg_stock_movement_no_direct_approved_insert
BEFORE INSERT ON stock_movements
WHEN NEW.approval_status = 'approved' AND NEW.movement_type <> 'opening'
BEGIN
  SELECT RAISE(ABORT, 'Only opening stock may be approved at insertion; all other movements require a pending approval workflow.');
END;

CREATE TRIGGER trg_stock_movement_opening_identity
BEFORE INSERT ON stock_movements
WHEN NEW.movement_type = 'opening'
 AND (NEW.approval_status <> 'approved' OR NEW.approved_by IS NULL OR NEW.approved_by <> NEW.recorded_by)
BEGIN
  SELECT RAISE(ABORT, 'Opening stock must be created as an approved opening balance by its recording user.');
END;

CREATE TRIGGER trg_stock_movement_prevent_negative_approved_insert
BEFORE INSERT ON stock_movements
WHEN NEW.approval_status = 'approved'
  AND (
    SELECT current_stock + NEW.quantity_delta
    FROM inventory_items
    WHERE id = NEW.item_id
  ) < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock movement would make on-hand quantity negative');
END;

CREATE TRIGGER trg_stock_movement_requires_independent_approver
BEFORE UPDATE OF approval_status, approved_by ON stock_movements
WHEN OLD.approval_status = 'pending'
 AND NEW.approval_status = 'approved'
 AND (NEW.approved_by IS NULL OR NEW.approved_by = NEW.recorded_by)
BEGIN
  SELECT RAISE(ABORT, 'Stock movements must be approved by a different user than the recorder.');
END;
