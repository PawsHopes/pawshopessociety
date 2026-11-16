interface D1Result<T = Record<string, unknown>> {
  results?: T[];
}

interface D1Statement {
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Binding {
  prepare(sql: string): D1Statement;
}

interface PagesEnv {
  DB?: D1Binding;
}

interface PagesContext {
  env: PagesEnv;
}

type PublicAnimalRow = {
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
};

type PublicMediaRow = { animal_id: string; public_url: string };

const RESCUE_STORY_STATUSES = new Set(['rescued', 'under_assessment', 'under_treatment', 'recovering']);

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  if (!context.env.DB) {
    return Response.json(
      { success: false, error: { code: 'ANIMAL_FEED_UNAVAILABLE', message: 'Animal listings are temporarily unavailable.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const [animalsResult, mediaResult] = await Promise.all([
      context.env.DB.prepare(`
        SELECT id, animal_code, legacy_slug, name, species, breed, gender,
          estimated_age_text AS age, health_summary AS health,
          public_description AS description, adopted_note AS adoptedNote,
          current_status
        FROM animals
        WHERE is_published_public = 1 AND deleted_at IS NULL
          AND (
            current_status = 'adopted'
            OR (current_status = 'available_for_adoption' AND is_adoption_eligible = 1)
            OR current_status IN ('rescued', 'under_assessment', 'under_treatment', 'recovering')
          )
        ORDER BY created_at ASC
      `).all<PublicAnimalRow>(),
      context.env.DB.prepare(`
        SELECT am.animal_id, ma.public_url
        FROM animal_media am
        JOIN media_assets ma ON ma.id = am.media_asset_id
        ORDER BY am.is_primary DESC, am.sort_order ASC
      `).all<PublicMediaRow>(),
    ]);

    const mediaByAnimal = new Map<string, string[]>();
    for (const media of mediaResult.results || []) {
      const images = mediaByAnimal.get(media.animal_id) || [];
      images.push(media.public_url);
      mediaByAnimal.set(media.animal_id, images);
    }

    const available: Record<string, unknown>[] = [];
    const adopted: Record<string, unknown>[] = [];
    const rescued: Record<string, unknown>[] = [];

    for (const animal of animalsResult.results || []) {
      const item = {
        id: animal.legacy_slug || animal.id,
        animalCode: animal.animal_code,
        name: animal.name,
        species: animal.species,
        breed: animal.breed || '',
        gender: animal.gender,
        age: animal.age || '',
        health: animal.health || '',
        description: animal.description || '',
        adoptedNote: animal.adoptedNote || undefined,
        currentStatus: animal.current_status,
        images: mediaByAnimal.get(animal.id) || [],
      };
      if (animal.current_status === 'adopted') adopted.push(item);
      else if (RESCUE_STORY_STATUSES.has(animal.current_status)) rescued.push(item);
      else available.push(item);
    }

    return Response.json(
      { success: true, data: { available, adopted, rescued } },
      { headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Content-Type-Options': 'nosniff',
      } },
    );
  } catch {
    return Response.json(
      { success: false, error: { code: 'ANIMAL_FEED_UNAVAILABLE', message: 'Animal listings are temporarily unavailable.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
