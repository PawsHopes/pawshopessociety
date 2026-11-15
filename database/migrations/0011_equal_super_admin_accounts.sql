-- Activate both designated accounts with the same Super Admin role.
-- Preserve existing IDs, profile details, and audit history when an account already exists.
INSERT INTO users (id, email, full_name, role_id, status)
SELECT 'user_super_admin_infosecayush', 'infosecayush@gmail.com', 'Super Admin', r.id, 'active'
FROM roles r
WHERE r.code = 'super_admin'
ON CONFLICT(email) DO UPDATE SET
  role_id = excluded.role_id,
  status = 'active',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');

INSERT INTO users (id, email, full_name, role_id, status)
SELECT 'user_super_admin_yivam', 'yivam24770@jcaton.com', 'Super Admin', r.id, 'active'
FROM roles r
WHERE r.code = 'super_admin'
ON CONFLICT(email) DO UPDATE SET
  role_id = excluded.role_id,
  status = 'active',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');
