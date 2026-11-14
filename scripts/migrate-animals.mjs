#!/usr/bin/env node
/**
 * Paw's Hopez Society — Animal Data Migration Script
 * Reads assets/data/animals.js, validates every image against assets/images/adoption/,
 * and generates idempotent D1 SQL seed + rollback scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const animalsJsPath = path.join(repoRoot, 'assets/data/animals.js');
const adoptionImgDir = path.join(repoRoot, 'assets/images/adoption');
const outSeedPath = path.join(repoRoot, 'database/seeds/0003_migrated_animals.sql');
const outRollbackPath = path.join(repoRoot, 'database/seeds/0003_migrated_animals_rollback.sql');

if (!fs.existsSync(animalsJsPath)) {
  console.error('ERROR: Could not find assets/data/animals.js at', animalsJsPath);
  process.exit(1);
}

const code = fs.readFileSync(animalsJsPath, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const available = sandbox.window.AVAILABLE_FOR_ADOPTION || [];
const adopted = sandbox.window.ADOPTED_ANIMALS || [];
const existingFiles = new Set(
  fs.existsSync(adoptionImgDir) ? fs.readdirSync(adoptionImgDir).filter((f) => f !== '.gitkeep') : []
);

const esc = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const lines = [
  '-- ============================================================================',
  '-- SEED 0003: MIGRATED ANIMALS & VERIFIED MEDIA FROM assets/data/animals.js',
  '-- ============================================================================',
  '',
];

const rollback = [
  '-- ============================================================================',
  '-- ROLLBACK 0003: REMOVE MIGRATED LEGACY ANIMALS & MEDIA ASSETS',
  '-- ============================================================================',
  "DELETE FROM animal_status_history WHERE animal_id LIKE 'animal_legacy_%';",
  "DELETE FROM animal_media WHERE animal_id LIKE 'animal_legacy_%';",
  "DELETE FROM animals WHERE id LIKE 'animal_legacy_%';",
  "DELETE FROM media_assets WHERE id LIKE 'media_legacy_%';",
];

let counter = 0;
const warnings = [];

function processGroup(list, isAdopted) {
  for (const animal of list) {
    counter += 1;
    const slug = animal.id || animal.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const aid = `animal_legacy_${slug.replace(/[^a-z0-9]+/g, '_')}`;
    const acode = `PHS-2026-${String(counter).padStart(3, '0')}`;
    const health = animal.health || '';
    const sterStatus = /sterilized/i.test(health) ? 'sterilized' : 'not_sterilized';
    const vaccStatus = /vaccinated/i.test(health) ? 'up_to_date' : 'pending';
    const status = isAdopted ? 'adopted' : 'available_for_adoption';

    lines.push(
      `INSERT OR IGNORE INTO animals (id, animal_code, legacy_slug, name, species, breed, gender, estimated_age_text, health_summary, vaccination_status, sterilization_status, is_adoption_eligible, is_foster_eligible, is_published_public, public_description, adopted_note, current_status) VALUES (` +
        `${esc(aid)}, ${esc(acode)}, ${esc(slug)}, ${esc(animal.name)}, ${esc(animal.species)}, ` +
        `${esc(animal.breed || null)}, ${esc(animal.gender || 'Unknown')}, ${esc(animal.age || null)}, ` +
        `${esc(health)}, ${esc(vaccStatus)}, ${esc(sterStatus)}, ${isAdopted ? 0 : 1}, ${isAdopted ? 0 : 1}, 1, ` +
        `${esc(animal.description || '')}, ${esc(animal.adoptedNote || null)}, ${esc(status)});`
    );

    lines.push(
      `INSERT OR IGNORE INTO animal_status_history (id, animal_id, from_status, to_status, reason) VALUES (` +
        `${esc('hist_' + aid)}, ${esc(aid)}, NULL, ${esc(status)}, 'Migrated from assets/data/animals.js');`
    );

    const imgs = Array.isArray(animal.images) ? animal.images : animal.photo ? [animal.photo] : [];
    let sortIdx = 0;
    for (const imgRel of imgs) {
      const base = path.basename(imgRel);
      if (!existingFiles.has(base)) {
        warnings.push(`[SKIPPED MISSING IMAGE] ${animal.name}: ${imgRel}`);
        continue;
      }
      const stats = fs.statSync(path.join(adoptionImgDir, base));
      const mid = `media_legacy_${base.replace(/[^a-zA-Z0-9]+/g, '_')}`;
      const amid = `amedia_${aid}_${sortIdx}`;
      lines.push(
        `INSERT OR IGNORE INTO media_assets (id, r2_key, public_url, file_name, mime_type, size_bytes, alt_text) VALUES (` +
          `${esc(mid)}, ${esc('adoption/' + base)}, ${esc('/' + imgRel)}, ${esc(base)}, 'image/webp', ${stats.size}, ${esc(`${animal.name} - ${animal.species}`)});`
      );
      lines.push(
        `INSERT OR IGNORE INTO animal_media (id, animal_id, media_asset_id, is_primary, sort_order) VALUES (` +
          `${esc(amid)}, ${esc(aid)}, ${esc(mid)}, ${sortIdx === 0 ? 1 : 0}, ${sortIdx});`
      );
      sortIdx += 1;
    }
  }
}

processGroup(available, false);
processGroup(adopted, true);

fs.mkdirSync(path.dirname(outSeedPath), { recursive: true });
fs.writeFileSync(outSeedPath, lines.join('\n') + '\n', 'utf8');
fs.writeFileSync(outRollbackPath, rollback.join('\n') + '\n', 'utf8');

console.log(`Migrated ${counter} animals to ${outSeedPath}`);
if (warnings.length > 0) {
  console.warn('Warnings:\n' + warnings.join('\n'));
}
