-- ============================================================================
-- ROLLBACK 0003: REMOVE MIGRATED LEGACY ANIMALS & MEDIA ASSETS
-- ============================================================================
DELETE FROM animal_status_history WHERE animal_id LIKE 'animal_legacy_%';
DELETE FROM animal_media WHERE animal_id LIKE 'animal_legacy_%';
DELETE FROM animals WHERE id LIKE 'animal_legacy_%';
DELETE FROM media_assets WHERE id LIKE 'media_legacy_%';