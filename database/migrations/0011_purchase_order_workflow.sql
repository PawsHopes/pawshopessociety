-- Enforce purchase order state transitions and link receipts to ordered POs.
ALTER TABLE stock_movements ADD COLUMN review_notes TEXT;

CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_insert_draft_only
BEFORE INSERT ON purchase_orders
WHEN NEW.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'Purchase orders must be created as draft');
END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_valid_status_transition
BEFORE UPDATE OF status ON purchase_orders
WHEN NEW.status <> OLD.status
  AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('ordered', 'cancelled'))
    OR
    (OLD.status = 'ordered' AND NEW.status = 'cancelled'
      AND NOT EXISTS (
        SELECT 1 FROM stock_movements
        WHERE purchase_order_id = OLD.id AND approval_status IN ('pending', 'approved')
      ))
    OR
    (OLD.status = 'ordered' AND NEW.status = 'received'
      AND EXISTS (
        SELECT 1 FROM stock_movements
        WHERE purchase_order_id = OLD.id AND approval_status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM stock_movements
        WHERE purchase_order_id = OLD.id AND approval_status = 'pending'
      ))
  )
BEGIN
  SELECT RAISE(ABORT, 'Invalid purchase order status transition or outstanding stock receipt');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_movement_purchase_in_requires_order
BEFORE INSERT ON stock_movements
WHEN NEW.movement_type = 'purchase_in' AND (
  NEW.purchase_order_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = NEW.purchase_order_id AND status = 'ordered'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'Purchase-in stock movements require an ordered purchase order');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_movement_purchase_in_starts_pending
BEFORE INSERT ON stock_movements
WHEN NEW.movement_type = 'purchase_in' AND NEW.approval_status <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'Purchase-in stock movements must start pending approval');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_movement_po_requires_purchase_in
BEFORE INSERT ON stock_movements
WHEN NEW.purchase_order_id IS NOT NULL AND NEW.movement_type <> 'purchase_in'
BEGIN
  SELECT RAISE(ABORT, 'Only purchase-in stock movements can be linked to a purchase order');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_movement_approval_requires_ordered_po
BEFORE UPDATE OF approval_status ON stock_movements
WHEN NEW.approval_status = 'approved'
  AND OLD.approval_status = 'pending'
  AND NEW.purchase_order_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = NEW.purchase_order_id AND status = 'ordered'
  )
BEGIN
  SELECT RAISE(ABORT, 'Stock receipt approval requires the purchase order to remain ordered');
END;
