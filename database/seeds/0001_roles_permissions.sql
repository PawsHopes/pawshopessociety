-- ============================================================================
-- SEED 0001: ROLES & GRANULAR RBAC PERMISSIONS
-- ============================================================================

INSERT OR IGNORE INTO roles (id, code, name, description) VALUES
  ('role_super_admin', 'super_admin', 'Super Admin / President', 'Full administrative control across all ERP modules, approvals, CMS, and user management.'),
  ('role_finance_manager', 'finance_manager', 'Finance Manager', 'Manages donations, receipts, expense approvals, ledger reversals, inventory POs, and statutory compliance.'),
  ('role_vet_staff', 'vet_staff', 'Veterinary / Medical Staff', 'Manages animal consultations, diagnoses, prescriptions, vaccinations, sterilization, and medical expense submissions.'),
  ('role_rescue_coord', 'rescue_coord', 'Rescue Coordinator', 'Manages emergency rescue cases, team dispatch, animal intake, and rescue story drafts.'),
  ('role_adoption_coord', 'adoption_coord', 'Adoption Coordinator', 'Manages adoption & foster applications, home checks, handover agreements, and public adoption listings.'),
  ('role_volunteer', 'volunteer', 'Volunteer', 'Limited access to assigned tasks, rescue field updates, and personal volunteer profile.'),
  ('role_auditor', 'auditor', 'Auditor (Read-Only)', 'Strict read-only access across financial ledgers, receipts, medical records, compliance docs, and audit logs.');

INSERT OR IGNORE INTO permissions (id, code, module, description) VALUES
  ('perm_dash_read', 'dashboard:read', 'dashboard', 'View executive dashboard metrics and alerts'),
  ('perm_animals_read', 'animals:read', 'animals', 'View animal registry records'),
  ('perm_animals_write', 'animals:write', 'animals', 'Create and update animal registry records and lifecycle statuses'),
  ('perm_animals_publish', 'animals:publish', 'animals', 'Publish or unpublish animals on the public adoption page'),
  ('perm_rescue_read', 'rescue:read', 'rescue', 'View rescue cases and updates'),
  ('perm_rescue_write', 'rescue:write', 'rescue', 'Create, assign, update, and close rescue cases'),
  ('perm_medical_read', 'medical:read', 'medical', 'View veterinary consultations, prescriptions, and vaccination records'),
  ('perm_medical_write', 'medical:write', 'medical', 'Create and update veterinary records, vaccinations, and medical expense claims'),
  ('perm_adoption_read', 'adoption:read', 'adoption', 'View adoption and foster applications'),
  ('perm_adoption_write', 'adoption:write', 'adoption', 'Process adoption/foster applications, home checks, and agreements'),
  ('perm_adoption_approve', 'adoption:approve', 'adoption', 'Approve or reject adoption and foster applications'),
  ('perm_donations_read', 'donations:read', 'donations', 'View donor database and donation records'),
  ('perm_donations_write', 'donations:write', 'donations', 'Record manual UPI/bank/cash donations and donor profiles'),
  ('perm_donations_verify', 'donations:verify', 'donations', 'Verify donations, post income ledger entries, and issue receipts'),
  ('perm_finance_read', 'finance:read', 'finance', 'View expense registers, cashbook, ledger, and financial statements'),
  ('perm_expenses_submit', 'expenses:submit', 'finance', 'Submit new expense claims with vendor bills'),
  ('perm_finance_approve', 'finance:approve', 'finance', 'Approve or reject submitted expenses (excluding own submissions)'),
  ('perm_finance_ledger', 'finance:ledger', 'finance', 'Post immutable ledger reversal entries and manage accounts'),
  ('perm_inventory_read', 'inventory:read', 'inventory', 'View shelter food, medicine, and supply stock levels'),
  ('perm_inventory_write', 'inventory:write', 'inventory', 'Record stock receipts, issues, and purchase orders'),
  ('perm_inventory_approve', 'inventory:approve', 'inventory', 'Approve stock adjustments and write-offs'),
  ('perm_volunteers_read', 'volunteers:read', 'volunteers', 'View volunteer and member directory'),
  ('perm_volunteers_write', 'volunteers:write', 'volunteers', 'Manage volunteer records and assign tasks'),
  ('perm_cms_read', 'cms:read', 'cms', 'View website CMS drafts and published sections'),
  ('perm_cms_write', 'cms:write', 'cms', 'Create and edit website CMS content drafts'),
  ('perm_cms_publish', 'cms:publish', 'cms', 'Publish or unpublish website CMS sections to live site'),
  ('perm_compliance_read', 'compliance:read', 'compliance', 'View statutory registrations, compliance registers, and exports'),
  ('perm_compliance_write', 'compliance:write', 'compliance', 'Update statutory registration records and upload compliance certificates'),
  ('perm_users_manage', 'users:manage', 'users', 'Create ERP users, assign roles, and suspend accounts'),
  ('perm_audit_read', 'audit:read', 'audit', 'View immutable system audit logs'),
  ('perm_docs_private_read', 'documents:private_read', 'documents', 'Generate short-lived signed URLs for private vault documents');

-- Super Admin: ALL permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_super_admin', id FROM permissions;

-- Finance Manager
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_finance_manager', id FROM permissions WHERE code IN (
  'dashboard:read', 'animals:read', 'rescue:read',
  'donations:read', 'donations:write', 'donations:verify',
  'finance:read', 'expenses:submit', 'finance:approve', 'finance:ledger',
  'inventory:read', 'inventory:write', 'inventory:approve',
  'compliance:read', 'compliance:write', 'documents:private_read'
);

-- Veterinary / Medical Staff (Cannot approve expenses or edit finance ledger)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_vet_staff', id FROM permissions WHERE code IN (
  'dashboard:read', 'animals:read', 'animals:write', 'rescue:read',
  'medical:read', 'medical:write', 'expenses:submit',
  'inventory:read', 'inventory:write', 'documents:private_read'
);

-- Rescue Coordinator
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_rescue_coord', id FROM permissions WHERE code IN (
  'dashboard:read', 'animals:read', 'animals:write',
  'rescue:read', 'rescue:write', 'medical:read',
  'expenses:submit', 'inventory:read', 'inventory:write',
  'volunteers:read', 'volunteers:write', 'cms:read', 'cms:write',
  'documents:private_read'
);

-- Adoption Coordinator
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_adoption_coord', id FROM permissions WHERE code IN (
  'dashboard:read', 'animals:read', 'animals:write', 'animals:publish',
  'medical:read', 'adoption:read', 'adoption:write', 'adoption:approve',
  'expenses:submit', 'cms:read', 'cms:write', 'documents:private_read'
);

-- Volunteer (Strictly limited portal access; NO financial or medical write access)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_volunteer', id FROM permissions WHERE code IN (
  'dashboard:read', 'animals:read', 'rescue:read', 'volunteers:read'
);

-- Auditor (Read-only across all operational, financial, compliance & audit records)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_auditor', id FROM permissions WHERE code IN (
  'dashboard:read', 'animals:read', 'rescue:read', 'medical:read',
  'adoption:read', 'donations:read', 'finance:read', 'inventory:read',
  'volunteers:read', 'cms:read', 'compliance:read', 'audit:read',
  'documents:private_read'
);
