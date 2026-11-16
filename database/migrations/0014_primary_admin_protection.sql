-- ============================================================================
-- 0014: PROTECT THE PAW'S HOPEZ SOCIETY PRIMARY ADMINISTRATOR AT DATABASE LEVEL
-- ============================================================================
-- API authorization is the primary control. These triggers provide defence in
-- depth against accidental or future code paths that bypass the user API.

CREATE TRIGGER IF NOT EXISTS trg_primary_admin_identity_immutable
BEFORE UPDATE OF email ON users
WHEN lower(trim(OLD.email)) = 'hopezpaws@gmail.com'
 AND lower(trim(NEW.email)) <> 'hopezpaws@gmail.com'
BEGIN
  SELECT RAISE(ABORT, 'The primary administrator identity cannot be changed');
END;

CREATE TRIGGER IF NOT EXISTS trg_primary_admin_role_status_immutable
BEFORE UPDATE OF role_id, status ON users
WHEN lower(trim(OLD.email)) = 'hopezpaws@gmail.com'
 AND (NEW.role_id IS NOT OLD.role_id OR NEW.status IS NOT OLD.status)
BEGIN
  SELECT RAISE(ABORT, 'The primary administrator role and status are protected');
END;

CREATE TRIGGER IF NOT EXISTS trg_primary_admin_no_delete
BEFORE DELETE ON users
WHEN lower(trim(OLD.email)) = 'hopezpaws@gmail.com'
BEGIN
  SELECT RAISE(ABORT, 'The primary administrator account cannot be deleted');
END;
