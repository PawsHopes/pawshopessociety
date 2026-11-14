-- ============================================================================
-- IMMUTABILITY TRIGGERS & PERFORMANCE INDEXES
-- ============================================================================

CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs are strictly append-only'); END;

CREATE TRIGGER trg_audit_logs_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs cannot be deleted'); END;

CREATE TRIGGER trg_fin_txn_no_update BEFORE UPDATE ON financial_transactions
BEGIN SELECT RAISE(ABORT, 'financial_transactions are immutable; post a reversal entry instead'); END;

CREATE TRIGGER trg_fin_txn_no_delete BEFORE DELETE ON financial_transactions
BEGIN SELECT RAISE(ABORT, 'financial_transactions cannot be deleted'); END;

CREATE TRIGGER trg_verified_donation_immutable BEFORE UPDATE ON donations
WHEN OLD.verification_status = 'verified' AND (
  NEW.amount_paise != OLD.amount_paise OR
  NEW.fund_category_id != OLD.fund_category_id OR
  NEW.account_id != OLD.account_id OR
  NEW.donation_date != OLD.donation_date
)
BEGIN SELECT RAISE(ABORT, 'Verified donation financial fields are immutable'); END;

CREATE TRIGGER trg_verified_donation_no_delete BEFORE DELETE ON donations
WHEN OLD.verification_status = 'verified'
BEGIN SELECT RAISE(ABORT, 'Verified donations cannot be deleted'); END;

CREATE TRIGGER trg_approved_expense_immutable BEFORE UPDATE ON expenses
WHEN OLD.approval_status = 'approved' AND (
  NEW.amount_paise != OLD.amount_paise OR
  NEW.fund_category_id != OLD.fund_category_id OR
  NEW.account_id != OLD.account_id OR
  NEW.expense_date != OLD.expense_date
)
BEGIN SELECT RAISE(ABORT, 'Approved expense financial fields are immutable'); END;

CREATE TRIGGER trg_approved_expense_no_delete BEFORE DELETE ON expenses
WHEN OLD.approval_status = 'approved'
BEGIN SELECT RAISE(ABORT, 'Approved expenses cannot be deleted'); END;

-- Operational Indexes
CREATE INDEX idx_animals_public ON animals(is_published_public, current_status, deleted_at);
CREATE INDEX idx_rescue_cases_status ON rescue_cases(status, priority, reported_at);
CREATE INDEX idx_medical_records_animal ON medical_records(animal_id, visit_date DESC);
CREATE INDEX idx_vaccinations_due ON vaccinations(next_due_date);
CREATE INDEX idx_donations_date ON donations(donation_date DESC, verification_status);
CREATE INDEX idx_expenses_status ON expenses(approval_status, expense_date DESC);
CREATE INDEX idx_fin_txn_date ON financial_transactions(txn_date DESC, fund_category_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id, created_at DESC);
CREATE INDEX idx_website_content_pub ON website_content(page_slug, status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
