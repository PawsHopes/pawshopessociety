-- Allow either designated Society Super Admin to manage the other account.
-- Keep the last-active-admin invariant at the database layer so concurrent requests
-- cannot remove both designated administrators.

DROP TRIGGER IF EXISTS trg_society_admin_role_status_immutable;

CREATE TRIGGER IF NOT EXISTS trg_keep_one_active_society_super_admin
BEFORE UPDATE OF role_id, status ON users
WHEN lower(trim(OLD.email)) IN ('hopezpaws@gmail.com', 'infosecayush@gmail.com')
 AND OLD.role_id = 'role_super_admin'
 AND OLD.status = 'active'
 AND (NEW.role_id <> 'role_super_admin' OR NEW.status <> 'active')
 AND (
   SELECT COUNT(*)
   FROM users
   WHERE lower(trim(email)) IN ('hopezpaws@gmail.com', 'infosecayush@gmail.com')
     AND role_id = 'role_super_admin'
     AND status = 'active'
 ) <= 1
BEGIN
  SELECT RAISE(ABORT, 'Cannot remove the last active designated Society Super Admin');
END;
