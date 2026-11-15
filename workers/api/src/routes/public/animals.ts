import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';

export const publicAnimalsRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

const RESCUE_STORY_STATUSES = ['rescued', 'under_assessment', 'under_treatment', 'recovering'] as const;

publicAnimalsRoutes.get('/', async (c) => {
  const animalsRes = await c.env.DB.prepare(
    `SELECT id, animal_code, legacy_slug, name, species, breed, gender,
            estimated_age_text as age, health_summary as health,
            public_description as description, adopted_note as adoptedNote,
            current_status
     FROM animals
     WHERE is_published_public = 1
       AND deleted_at IS NULL
       AND (
         current_status = 'adopted'
         OR (current_status = 'available_for_adoption' AND is_adoption_eligible = 1)
         OR current_status IN ('rescued', 'under_assessment', 'under_treatment', 'recovering')
       )
     ORDER BY created_at ASC`
  ).all<{
    id: string;
    animal_code: string;
    legacy_slug: string | null;
    name: string;
    species: string;
    breed: string | null;
    gender: string;
    age: string | null;
    health: string | null;
    description: string | null;
    adoptedNote: string | null;
    current_status: string;
  }>();

  const mediaRes = await c.env.DB.prepare(
    `SELECT am.animal_id, ma.public_url
     FROM animal_media am
     JOIN media_assets ma ON ma.id = am.media_asset_id
     ORDER BY am.is_primary DESC, am.sort_order ASC`
  ).all<{ animal_id: string; public_url: string }>();

  const mediaByAnimal = new Map<string, string[]>();
  for (const row of mediaRes.results || []) {
    const arr = mediaByAnimal.get(row.animal_id) || [];
    arr.push(row.public_url);
    mediaByAnimal.set(row.animal_id, arr);
  }

  const available: Array<Record<string, unknown>> = [];
  const adopted: Array<Record<string, unknown>> = [];
  const rescued: Array<Record<string, unknown>> = [];

  for (const a of animalsRes.results || []) {
    const formatted = {
      id: a.legacy_slug || a.id,
      animalCode: a.animal_code,
      name: a.name,
      species: a.species,
      breed: a.breed || '',
      gender: a.gender,
      age: a.age || '',
      health: a.health || '',
      description: a.description || '',
      adoptedNote: a.adoptedNote || undefined,
      currentStatus: a.current_status,
      images: mediaByAnimal.get(a.id) || [],
    };
    if (a.current_status === 'adopted') adopted.push(formatted);
    else if (RESCUE_STORY_STATUSES.includes(a.current_status as typeof RESCUE_STORY_STATUSES[number])) rescued.push(formatted);
    else available.push(formatted);
  }

  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  return c.json({ success: true, data: { available, adopted, rescued } });
});
