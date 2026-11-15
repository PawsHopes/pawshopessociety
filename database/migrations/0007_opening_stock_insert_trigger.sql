-- Record approved opening stock at insert time so stock is never silently initialized.
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

CREATE TRIGGER trg_stock_movement_apply_approved_insert
AFTER INSERT ON stock_movements
WHEN NEW.approval_status = 'approved'
BEGIN
  UPDATE inventory_items
  SET current_stock = current_stock + NEW.quantity_delta,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.item_id;
END;
