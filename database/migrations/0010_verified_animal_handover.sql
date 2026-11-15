-- Enforce animal handover through approved adoption/foster workflows.
-- Direct status edits must not bypass approval and signed handover records.

CREATE TRIGGER IF NOT EXISTS trg_animals_prevent_adopted_fostered_insert
BEFORE INSERT ON animals
WHEN NEW.current_status IN ('adopted', 'fostered')
BEGIN
  SELECT RAISE(ABORT, 'Animals cannot be created directly as adopted or fostered');
END;

CREATE TRIGGER IF NOT EXISTS trg_animals_require_adoption_agreement
BEFORE UPDATE OF current_status ON animals
WHEN NEW.current_status = 'adopted'
  AND OLD.current_status <> 'adopted'
  AND NOT EXISTS (
    SELECT 1
    FROM adoption_agreements ag
    JOIN adoption_applications aa ON aa.id = ag.application_id
    WHERE ag.animal_id = NEW.id
      AND aa.status = 'approved'
  )
BEGIN
  SELECT RAISE(ABORT, 'Adoption status requires an approved application and adoption agreement');
END;

CREATE TRIGGER IF NOT EXISTS trg_animals_require_active_foster
BEFORE UPDATE OF current_status ON animals
WHEN NEW.current_status = 'fostered'
  AND OLD.current_status <> 'fostered'
  AND NOT EXISTS (
    SELECT 1 FROM foster_applications
    WHERE animal_id = NEW.id AND status = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'Foster status requires an active foster placement');
END;

CREATE TRIGGER IF NOT EXISTS trg_adoption_agreement_validate_handover
BEFORE INSERT ON adoption_agreements
WHEN NOT EXISTS (
  SELECT 1
  FROM adoption_applications aa
  JOIN animals a ON a.id = aa.animal_id
  WHERE aa.id = NEW.application_id
    AND aa.animal_id = NEW.animal_id
    AND aa.status = 'approved'
    AND aa.home_check_status = 'passed'
    AND a.current_status = 'available_for_adoption'
    AND a.is_adoption_eligible = 0
    AND a.deleted_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Adoption handover requires an approved application and reserved eligible animal');
END;

CREATE TRIGGER IF NOT EXISTS trg_adoption_agreement_complete_handover
AFTER INSERT ON adoption_agreements
BEGIN
  INSERT INTO animal_status_history (id, animal_id, from_status, to_status, reason, changed_by)
  SELECT lower(hex(randomblob(16))), a.id, a.current_status, 'adopted',
         'Adoption agreement handover', NEW.witnessed_by
  FROM animals a WHERE a.id = NEW.animal_id;

  UPDATE animals
  SET current_status = 'adopted',
      is_adoption_eligible = 0,
      is_foster_eligible = 0,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.animal_id;

  UPDATE adoption_applications
  SET status = 'handover',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.application_id AND status = 'approved';
END;

CREATE TRIGGER IF NOT EXISTS trg_foster_application_validate_activation
BEFORE UPDATE OF status ON foster_applications
WHEN NEW.status = 'active' AND OLD.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = NEW.animal_id
      AND a.is_foster_eligible = 1
      AND a.deleted_at IS NULL
      AND a.current_status NOT IN ('adopted', 'fostered', 'released', 'deceased')
  )
BEGIN
  SELECT RAISE(ABORT, 'Foster activation requires an active animal marked foster-eligible');
END;

CREATE TRIGGER IF NOT EXISTS trg_foster_application_activate_animal
AFTER UPDATE OF status ON foster_applications
WHEN NEW.status = 'active' AND OLD.status = 'approved'
BEGIN
  INSERT INTO animal_status_history (id, animal_id, from_status, to_status, reason, changed_by)
  SELECT lower(hex(randomblob(16))), a.id, a.current_status, 'fostered',
         'Foster placement activated', NEW.reviewed_by
  FROM animals a WHERE a.id = NEW.animal_id;

  UPDATE animals
  SET current_status = 'fostered',
      is_foster_eligible = 0,
      is_adoption_eligible = 0,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.animal_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_foster_application_validate_completion
BEFORE UPDATE OF status ON foster_applications
WHEN NEW.status = 'completed' AND OLD.status = 'active'
  AND (NEW.actual_end_date IS NULL OR trim(NEW.actual_end_date) = '')
BEGIN
  SELECT RAISE(ABORT, 'Foster completion requires an actual end date');
END;

CREATE TRIGGER IF NOT EXISTS trg_foster_application_complete_animal
AFTER UPDATE OF status ON foster_applications
WHEN NEW.status = 'completed' AND OLD.status = 'active'
BEGIN
  INSERT INTO animal_status_history (id, animal_id, from_status, to_status, reason, changed_by)
  SELECT lower(hex(randomblob(16))), a.id, a.current_status, 'recovering',
         'Foster placement completed; animal returned to shelter care', NEW.reviewed_by
  FROM animals a WHERE a.id = NEW.animal_id;

  UPDATE animals
  SET current_status = 'recovering',
      is_foster_eligible = 1,
      is_adoption_eligible = 0,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.animal_id;
END;
