-- ============================================================================
-- 0005: APPROVAL-GATED STOCK MOVEMENTS AND DOUBLE-ENTRY ACCOUNT BALANCES
-- ============================================================================

-- Pending stock movements do not affect on-hand quantity. Approval applies the
-- signed movement exactly once; insufficient stock aborts the approval.
CREATE TRIGGER trg_stock_movement_prevent_negative
BEFORE UPDATE OF approval_status ON stock_movements
WHEN OLD.approval_status = 'pending'
  AND NEW.approval_status = 'approved'
  AND (
    SELECT current_stock + NEW.quantity_delta
    FROM inventory_items
    WHERE id = NEW.item_id
  ) < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock movement would make on-hand quantity negative');
END;

CREATE TRIGGER trg_stock_movement_apply_approval
AFTER UPDATE OF approval_status ON stock_movements
WHEN OLD.approval_status = 'pending'
  AND NEW.approval_status = 'approved'
BEGIN
  UPDATE inventory_items
  SET current_stock = current_stock + NEW.quantity_delta,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.item_id;
END;

CREATE TRIGGER trg_stock_movement_approved_immutable
BEFORE UPDATE ON stock_movements
WHEN OLD.approval_status = 'approved'
BEGIN
  SELECT RAISE(ABORT, 'Approved stock movements are immutable; record a correcting movement');
END;

CREATE TRIGGER trg_stock_movement_approved_no_delete
BEFORE DELETE ON stock_movements
WHEN OLD.approval_status = 'approved'
BEGIN
  SELECT RAISE(ABORT, 'Approved stock movements cannot be deleted');
END;

-- A ledger posting updates account balances using normal debit/credit balances:
-- debits increase assets/expenses; credits increase liabilities/income.
CREATE TRIGGER trg_financial_transaction_update_balances
AFTER INSERT ON financial_transactions
BEGIN
  UPDATE accounts
  SET current_balance_paise = current_balance_paise +
    CASE WHEN account_type IN ('asset', 'expense')
      THEN NEW.amount_paise ELSE -NEW.amount_paise END
  WHERE id = NEW.debit_account_id;

  UPDATE accounts
  SET current_balance_paise = current_balance_paise +
    CASE WHEN account_type IN ('liability', 'income')
      THEN NEW.amount_paise ELSE -NEW.amount_paise END
  WHERE id = NEW.credit_account_id;
END;

CREATE TRIGGER trg_financial_transaction_distinct_accounts
BEFORE INSERT ON financial_transactions
WHEN NEW.debit_account_id = NEW.credit_account_id
BEGIN
  SELECT RAISE(ABORT, 'A ledger transaction must use two different accounts');
END;

-- Prevent duplicate postings when two operators process the same source record concurrently.
CREATE UNIQUE INDEX idx_financial_transactions_source_once
ON financial_transactions(reference_type, reference_id, entry_type)
WHERE reference_type IN ('donation', 'expense') AND entry_type IN ('income', 'expense');
