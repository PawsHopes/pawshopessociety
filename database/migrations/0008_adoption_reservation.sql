-- Reserve an animal as soon as an adoption application is approved.
-- The reservation is enforced in the database so concurrent approvals cannot
-- assign the same animal to multiple adopters.

CREATE UNIQUE INDEX IF NOT EXISTS idx_adoption_applications_one_approved_per_animal
ON adoption_applications(animal_id)
WHERE status = 'approved';

CREATE TRIGGER IF NOT EXISTS trg_adoption_application_requires_eligible_animal
BEFORE UPDATE OF status ON adoption_applications
WHEN NEW.status = 'approved'
  AND OLD.status <> 'approved'
  AND NOT EXISTS (
    SELECT 1
    FROM animals
    WHERE id = NEW.animal_id
      AND is_adoption_eligible = 1
      AND current_status = 'available_for_adoption'
  )
BEGIN
  SELECT RAISE(ABORT, 'Animal is not currently eligible for adoption');
END;

CREATE TRIGGER IF NOT EXISTS trg_adoption_application_reserves_animal
AFTER UPDATE OF status ON adoption_applications
WHEN NEW.status = 'approved'
  AND OLD.status <> 'approved'
BEGIN
  UPDATE animals
  SET is_adoption_eligible = 0,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.animal_id;
END;
