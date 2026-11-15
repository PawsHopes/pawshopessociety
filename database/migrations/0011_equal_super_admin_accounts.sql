-- Ensure both designated Society administrators have identical full Super Admin access.
-- Existing user IDs, names, phone numbers, and audit history are preserved.
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
