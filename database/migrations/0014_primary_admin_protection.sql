-- ============================================================================
-- 0014: PROTECT BOTH DESIGNATED PAW'S HOPEZ SOCIETY SUPER ADMINISTRATORS
-- ============================================================================
-- API authorization remains the primary control. These triggers protect both
-- designated administrators against accidental or bypass-path demotion,
-- suspension, identity changes, and deletion.

CREATE TRIGGER IF NOT EXISTS trg_society_admin_identity_immutable
BEFORE UPDATE OF email ON users
WHEN lower(trim(OLD.email)) IN ('hopezpaws@gmail.com', 'infosecayush@gmail.com')
 AND lower(trim(NEW.email)) <> lower(trim(OLD.email))
BEGIN
  SELECT RAISE(ABORT, 'Designated Society administrator identity cannot be changed');
END;

CREATE TRIGGER IF NOT EXISTS trg_society_admin_role_status_immutable
BEFORE UPDATE OF role_id, status ON users
WHEN lower(trim(OLD.email)) IN ('hopezpaws@gmail.com', 'infosecayush@gmail.com')
 AND ((OLD.role_id = 'role_super_admin' AND NEW.role_id <> OLD.role_id)
      OR (OLD.status = 'active' AND NEW.status <> 'active'))
BEGIN
  SELECT RAISE(ABORT, 'Designated Society administrator role and status are protected');
END;

CREATE TRIGGER IF NOT EXISTS trg_society_admin_no_delete
BEFORE DELETE ON users
WHEN lower(trim(OLD.email)) IN ('hopezpaws@gmail.com', 'infosecayush@gmail.com')
BEGIN
  SELECT RAISE(ABORT, 'Designated Society administrator accounts cannot be deleted');
END;
