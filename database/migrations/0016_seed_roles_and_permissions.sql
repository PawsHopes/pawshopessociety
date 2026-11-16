-- Seed the RBAC catalogue required by bootstrap, login and all ERP modules.
-- Safe to apply more than once in isolated staging/development databases.

INSERT OR IGNORE INTO roles (id, code, name, description) VALUES
  ('role_super_admin', 'super_admin', 'Super Admin', 'Full Society ERP administration'),
  ('role_finance_manager', 'finance_manager', 'Finance Manager', 'Donations, finance and expense workflows'),
  ('role_vet_staff', 'vet_staff', 'Veterinary Staff', 'Animal medical and vaccination records'),
  ('role_rescue_coord', 'rescue_coord', 'Rescue Coordinator', 'Rescue cases and animal intake'),
  ('role_adoption_coord', 'adoption_coord', 'Adoption Coordinator', 'Adoption and foster workflows'),
  ('role_volunteer', 'volunteer', 'Volunteer', 'Limited volunteer access'),
  ('role_auditor', 'auditor', 'Auditor', 'Read-only oversight and audit access');

INSERT OR IGNORE INTO permissions (id, code, module, description) VALUES
  ('perm_dashboard_read', 'dashboard:read', 'dashboard', 'View ERP dashboard'),
  ('perm_users_manage', 'users:manage', 'users', 'Manage ERP users and roles'),
  ('perm_audit_read', 'audit:read', 'audit', 'View audit logs'),
  ('perm_animals_read', 'animals:read', 'animals', 'View animal registry'),
  ('perm_animals_write', 'animals:write', 'animals', 'Create and update animal records'),
  ('perm_animals_publish', 'animals:publish', 'animals', 'Publish animal records to public website'),
  ('perm_rescue_read', 'rescue:read', 'rescue', 'View rescue cases'),
  ('perm_rescue_write', 'rescue:write', 'rescue', 'Manage rescue cases'),
  ('perm_medical_read', 'medical:read', 'medical', 'View medical records'),
  ('perm_medical_write', 'medical:write', 'medical', 'Manage medical records'),
  ('perm_adoption_read', 'adoption:read', 'adoption', 'View adoption and foster records'),
  ('perm_adoption_write', 'adoption:write', 'adoption', 'Manage adoption and foster records'),
  ('perm_adoption_approve', 'adoption:approve', 'adoption', 'Approve adoption workflows'),
  ('perm_donations_read', 'donations:read', 'donations', 'View donors and donations'),
  ('perm_donations_write', 'donations:write', 'donations', 'Manage donors and donations'),
  ('perm_donations_verify', 'donations:verify', 'donations', 'Verify donations'),
  ('perm_finance_read', 'finance:read', 'finance', 'View financial records'),
  ('perm_finance_approve', 'finance:approve', 'finance', 'Approve financial workflows'),
  ('perm_finance_ledger', 'finance:ledger', 'finance', 'Manage financial ledger'),
  ('perm_expenses_submit', 'expenses:submit', 'finance', 'Submit expenses'),
  ('perm_inventory_read', 'inventory:read', 'inventory', 'View inventory'),
  ('perm_inventory_write', 'inventory:write', 'inventory', 'Manage inventory and purchase orders'),
  ('perm_inventory_approve', 'inventory:approve', 'inventory', 'Approve inventory workflows'),
  ('perm_compliance_read', 'compliance:read', 'compliance', 'View compliance records'),
  ('perm_compliance_write', 'compliance:write', 'compliance', 'Manage compliance records'),
  ('perm_volunteers_read', 'volunteers:read', 'volunteers', 'View volunteers and tasks'),
  ('perm_volunteers_write', 'volunteers:write', 'volunteers', 'Manage volunteers and tasks'),
  ('perm_cms_read', 'cms:read', 'cms', 'View website content'),
  ('perm_cms_write', 'cms:write', 'cms', 'Edit website content'),
  ('perm_cms_publish', 'cms:publish', 'cms', 'Publish website content');

-- Designated Super Admins receive every permission in the catalogue.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_super_admin', id FROM permissions;

-- Least-privilege role mappings for operational users.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_finance_manager', id FROM permissions
WHERE code IN ('dashboard:read','audit:read','donations:read','donations:write','donations:verify',
               'finance:read','finance:approve','finance:ledger','expenses:submit','inventory:read');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_vet_staff', id FROM permissions
WHERE code IN ('dashboard:read','animals:read','rescue:read','medical:read','medical:write');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_rescue_coord', id FROM permissions
WHERE code IN ('dashboard:read','animals:read','animals:write','rescue:read','rescue:write',
               'medical:read','volunteers:read');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_adoption_coord', id FROM permissions
WHERE code IN ('dashboard:read','animals:read','adoption:read','adoption:write','adoption:approve',
               'animals:publish','volunteers:read');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_volunteer', id FROM permissions
WHERE code IN ('dashboard:read','animals:read','rescue:read','volunteers:read');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role_auditor', id FROM permissions
WHERE code IN ('dashboard:read','audit:read','animals:read','rescue:read','medical:read',
               'adoption:read','donations:read','finance:read','inventory:read','compliance:read',
               'volunteers:read','cms:read');
