PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. IDENTITY, RBAC & AUDIT GOVERNANCE
-- ============================================================================

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code IN (
    'super_admin', 'finance_manager', 'vet_staff',
    'rescue_coord', 'adoption_coord', 'volunteer', 'auditor'
  )),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  alt_text TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  r2_private_key TEXT NOT NULL UNIQUE,
  doc_category TEXT NOT NULL CHECK (doc_category IN (
    'vet_bill', 'prescription', 'lab_report', 'vaccination_cert',
    'adoption_agreement', 'foster_agreement', 'applicant_id',
    'donor_proof', 'donation_receipt', 'expense_invoice',
    'purchase_invoice', 'compliance_cert', 'rescue_evidence', 'other'
  )),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  expiry_date TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'expense', 'adoption_application', 'foster_application',
    'stock_adjustment', 'cms_publish', 'ledger_reversal'
  )),
  entity_id TEXT NOT NULL,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  remarks TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  target_role_code TEXT,
  dedupe_key TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN (
    'vaccination_due', 'low_stock', 'stock_expiry',
    'doc_expiry', 'approval_needed', 'new_rescue', 'new_adoption'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- 2. VOLUNTEERS, RESCUE CASES & ANIMAL REGISTRY
-- ============================================================================

CREATE TABLE volunteers (
  id TEXT PRIMARY KEY,
  volunteer_code TEXT NOT NULL UNIQUE,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  skills_json TEXT NOT NULL DEFAULT '[]',
  availability TEXT,
  role_type TEXT NOT NULL DEFAULT 'volunteer' CHECK (role_type IN ('volunteer', 'member')),
  status TEXT NOT NULL DEFAULT 'applicant' CHECK (status IN ('applicant', 'active', 'inactive')),
  joined_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE volunteer_tasks (
  id TEXT PRIMARY KEY,
  volunteer_id TEXT NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'feeding', 'rescue', 'shelter_care', 'medical_assist', 'event', 'transport', 'admin'
  )),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date TEXT NOT NULL,
  hours_logged REAL DEFAULT 0 CHECK (hours_logged >= 0),
  attendance_status TEXT NOT NULL DEFAULT 'assigned' CHECK (attendance_status IN (
    'assigned', 'completed', 'missed', 'cancelled'
  )),
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE rescue_cases (
  id TEXT PRIMARY KEY,
  case_code TEXT NOT NULL UNIQUE,
  reporter_name TEXT NOT NULL,
  reporter_phone TEXT NOT NULL,
  reporter_email TEXT,
  location_address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  species TEXT NOT NULL DEFAULT 'Dog',
  animal_description TEXT NOT NULL,
  complaint_details TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'verified', 'assigned', 'in_progress', 'rescued', 'not_rescued', 'closed'
  )),
  outcome_notes TEXT,
  assigned_volunteer_id TEXT REFERENCES volunteers(id) ON DELETE SET NULL,
  rescue_team_notes TEXT,
  reported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE rescue_case_updates (
  id TEXT PRIMARY KEY,
  rescue_case_id TEXT NOT NULL REFERENCES rescue_cases(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT NOT NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE animals (
  id TEXT PRIMARY KEY,
  animal_code TEXT NOT NULL UNIQUE,
  legacy_slug TEXT UNIQUE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN (
    'Dog', 'Cat', 'Monkey', 'Bird', 'Squirrel', 'Guinea Pig', 'Reptile', 'Other'
  )),
  breed TEXT,
  gender TEXT NOT NULL DEFAULT 'Unknown' CHECK (gender IN ('Male', 'Female', 'Unknown')),
  estimated_age_text TEXT,
  estimated_dob TEXT,
  identification_marks TEXT,
  microchip_or_tag TEXT,
  rescue_date TEXT,
  rescue_location TEXT,
  rescue_source TEXT,
  rescue_case_id TEXT REFERENCES rescue_cases(id) ON DELETE SET NULL,
  health_summary TEXT,
  vaccination_status TEXT NOT NULL DEFAULT 'pending' CHECK (vaccination_status IN (
    'not_vaccinated', 'partial', 'up_to_date', 'pending'
  )),
  sterilization_status TEXT NOT NULL DEFAULT 'not_sterilized' CHECK (sterilization_status IN (
    'not_sterilized', 'scheduled', 'sterilized', 'not_applicable'
  )),
  sterilization_date TEXT,
  kennel_zone TEXT,
  caretaker_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_adoption_eligible INTEGER NOT NULL DEFAULT 0 CHECK (is_adoption_eligible IN (0, 1)),
  is_foster_eligible INTEGER NOT NULL DEFAULT 0 CHECK (is_foster_eligible IN (0, 1)),
  is_published_public INTEGER NOT NULL DEFAULT 0 CHECK (is_published_public IN (0, 1)),
  public_description TEXT,
  adopted_note TEXT,
  internal_notes TEXT,
  current_status TEXT NOT NULL DEFAULT 'rescued' CHECK (current_status IN (
    'rescued', 'under_assessment', 'under_treatment', 'recovering',
    'available_for_adoption', 'fostered', 'adopted', 'released', 'deceased'
  )),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE animal_media (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (animal_id, media_asset_id)
);

CREATE TABLE animal_status_history (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- 3. VETERINARY & MEDICAL MANAGEMENT
-- ============================================================================

CREATE TABLE veterinarians (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  clinic_name TEXT,
  registration_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE medical_records (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  veterinarian_id TEXT REFERENCES veterinarians(id) ON DELETE SET NULL,
  visit_date TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN (
    'consultation', 'surgery', 'sterilization', 'deworming', 'lab_test', 'emergency', 'follow_up'
  )),
  symptoms TEXT,
  diagnosis TEXT NOT NULL,
  prescription_text TEXT,
  medication_history_notes TEXT,
  treatment_notes TEXT,
  follow_up_date TEXT,
  attachment_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE vaccinations (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  vaccine_name TEXT NOT NULL,
  batch_number TEXT,
  administered_date TEXT NOT NULL,
  next_due_date TEXT,
  veterinarian_id TEXT REFERENCES veterinarians(id) ON DELETE SET NULL,
  certificate_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- 4. ADOPTION & FOSTER PIPELINES
-- ============================================================================

CREATE TABLE adoption_applications (
  id TEXT PRIMARY KEY,
  application_code TEXT NOT NULL UNIQUE,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  applicant_email TEXT,
  applicant_address TEXT NOT NULL,
  housing_type TEXT,
  has_other_pets INTEGER NOT NULL DEFAULT 0 CHECK (has_other_pets IN (0, 1)),
  experience_notes TEXT,
  id_proof_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  home_check_status TEXT NOT NULL DEFAULT 'pending' CHECK (home_check_status IN (
    'pending', 'scheduled', 'passed', 'failed'
  )),
  home_check_notes TEXT,
  status TEXT NOT NULL DEFAULT 'application' CHECK (status IN (
    'application', 'initial_review', 'verification', 'approved',
    'rejected', 'handover', 'follow_up', 'completed'
  )),
  rejection_reason TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE foster_applications (
  id TEXT PRIMARY KEY,
  application_code TEXT NOT NULL UNIQUE,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  applicant_email TEXT,
  applicant_address TEXT NOT NULL,
  foster_start_date TEXT,
  expected_end_date TEXT,
  actual_end_date TEXT,
  id_proof_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'application' CHECK (status IN (
    'application', 'verification', 'approved', 'active', 'completed', 'rejected'
  )),
  notes TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE adoption_agreements (
  id TEXT PRIMARY KEY,
  agreement_number TEXT NOT NULL UNIQUE,
  application_id TEXT NOT NULL UNIQUE REFERENCES adoption_applications(id) ON DELETE RESTRICT,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  handover_date TEXT NOT NULL,
  signed_agreement_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  handover_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  follow_up_30d_date TEXT,
  follow_up_30d_notes TEXT,
  follow_up_90d_date TEXT,
  follow_up_90d_notes TEXT,
  witnessed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- 5. DONATIONS, IMMUTABLE ACCOUNTING & MEDICAL EXPENSES
-- ============================================================================

CREATE TABLE fund_categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_restricted INTEGER NOT NULL DEFAULT 0 CHECK (is_restricted IN (0, 1)),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'income', 'expense')),
  current_balance_paise INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE donors (
  id TEXT PRIMARY KEY,
  donor_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  phone TEXT,
  pan_number TEXT,
  address TEXT,
  donor_type TEXT NOT NULL DEFAULT 'individual' CHECK (donor_type IN ('individual', 'corporate', 'institutional')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE donations (
  id TEXT PRIMARY KEY,
  donor_id TEXT NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
  fund_category_id TEXT NOT NULL REFERENCES fund_categories(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  donation_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('upi', 'bank_transfer', 'cash', 'razorpay', 'cheque', 'other')),
  transaction_reference TEXT UNIQUE,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  purpose TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'verified', 'failed', 'refunded'
  )),
  verified_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TEXT,
  proof_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

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

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  expense_code TEXT NOT NULL UNIQUE,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'animal_food', 'vet_consultation', 'medicines', 'vaccination',
    'sterilization', 'transportation', 'rescue_operations',
    'shelter_maintenance', 'utilities', 'equipment', 'administrative', 'other'
  )),
  fund_category_id TEXT NOT NULL REFERENCES fund_categories(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('upi', 'bank_transfer', 'cash', 'card', 'other')),
  vendor_payee TEXT NOT NULL,
  animal_id TEXT REFERENCES animals(id) ON DELETE RESTRICT,
  rescue_case_id TEXT REFERENCES rescue_cases(id) ON DELETE RESTRICT,
  invoice_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  submitted_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE medical_expenses (
  id TEXT PRIMARY KEY,
  medical_record_id TEXT REFERENCES medical_records(id) ON DELETE RESTRICT,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  expense_id TEXT NOT NULL UNIQUE REFERENCES expenses(id) ON DELETE RESTRICT,
  invoice_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY,
  txn_number TEXT NOT NULL UNIQUE,
  txn_date TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense', 'transfer', 'reversal')),
  reverses_txn_id TEXT UNIQUE REFERENCES financial_transactions(id) ON DELETE RESTRICT,
  debit_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  credit_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  fund_category_id TEXT NOT NULL REFERENCES fund_categories(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('donation', 'expense', 'reversal', 'opening_balance')),
  reference_id TEXT NOT NULL,
  narration TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- 6. INVENTORY, CMS & STATUTORY COMPLIANCE
-- ============================================================================

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  address TEXT,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'dog_food', 'cat_food', 'medicines', 'vaccines',
    'supplements', 'cleaning_supplies', 'medical_equipment', 'other'
  )),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'g', 'l', 'ml', 'tablet', 'vial', 'bottle', 'pack', 'piece')),
  opening_stock REAL NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
  current_stock REAL NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_threshold REAL NOT NULL DEFAULT 0 CHECK (min_stock_threshold >= 0),
  expiry_tracking_enabled INTEGER NOT NULL DEFAULT 0 CHECK (expiry_tracking_enabled IN (0, 1)),
  preferred_supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  order_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  total_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_paise >= 0),
  invoice_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'opening', 'purchase_in', 'issue_out', 'expired_writeoff', 'adjustment'
  )),
  quantity_delta REAL NOT NULL CHECK (quantity_delta != 0),
  batch_number TEXT,
  expiry_date TEXT,
  animal_id TEXT REFERENCES animals(id) ON DELETE SET NULL,
  purchase_order_id TEXT REFERENCES purchase_orders(id) ON DELETE SET NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected')),
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  recorded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE website_content (
  id TEXT PRIMARY KEY,
  page_slug TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body_json TEXT NOT NULL,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version_number INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (page_slug, section_key, version_number)
);

CREATE TABLE compliance_registrations (
  id TEXT PRIMARY KEY,
  reg_type TEXT NOT NULL UNIQUE CHECK (reg_type IN (
    'society_registration', 'pan', 'ngo_darpan', '12a', '80g', 'awbi', 'csr1'
  )),
  registration_number TEXT,
  issuing_authority TEXT,
  status TEXT NOT NULL DEFAULT 'not_applied' CHECK (status IN (
    'not_applied', 'applied', 'provisional', 'active', 'expired'
  )),
  valid_from TEXT,
  valid_until TEXT,
  certificate_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  notes TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
