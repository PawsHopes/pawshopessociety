-- Complete shelter registry: separate physical shelter presence from lifecycle status
-- and capture disability / long-term health / special-care information.
ALTER TABLE animals ADD COLUMN is_currently_in_shelter INTEGER NOT NULL DEFAULT 1
  CHECK (is_currently_in_shelter IN (0, 1));
ALTER TABLE animals ADD COLUMN health_conditions TEXT;
ALTER TABLE animals ADD COLUMN mobility_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (mobility_status IN ('normal', 'limited', 'paralysed', 'wheelchair_or_support', 'unknown'));
ALTER TABLE animals ADD COLUMN special_care_notes TEXT;

-- Existing animals already marked as outside the shelter must not inflate the shelter headcount.
UPDATE animals
SET is_currently_in_shelter = CASE
  WHEN current_status IN ('fostered', 'adopted', 'released', 'deceased') THEN 0
  ELSE 1
END;

CREATE TRIGGER animals_shelter_presence_after_insert
AFTER INSERT ON animals
BEGIN
  UPDATE animals
  SET is_currently_in_shelter = CASE
    WHEN NEW.current_status IN ('fostered', 'adopted', 'released', 'deceased') THEN 0
    ELSE NEW.is_currently_in_shelter
  END
  WHERE id = NEW.id;
END;

CREATE TRIGGER animals_shelter_presence_after_status_update
AFTER UPDATE OF current_status ON animals
BEGIN
  UPDATE animals
  SET is_currently_in_shelter = CASE
    WHEN NEW.current_status IN ('fostered', 'adopted', 'released', 'deceased') THEN 0
    ELSE 1
  END
  WHERE id = NEW.id;
END;

CREATE INDEX idx_animals_shelter_status ON animals(is_currently_in_shelter, current_status);
