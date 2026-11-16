import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { publicAnimalsRoutes } from '../src/routes/public/animals';
import type { Bindings, AppVariables } from '../src/types/env';

describe('public animal publishing feed', () => {
  it('queries only published, non-archived animals and groups records by lifecycle', async () => {
    const sql: string[] = [];
    const animals = [
      { id: 'a1', animal_code: 'PHS-001', legacy_slug: null, name: 'Milo', species: 'Dog', breed: 'Indie', gender: 'Male', age: '2 years', health: 'Healthy', description: 'Ready for a home', adoptedNote: null, current_status: 'available_for_adoption' },
      { id: 'a2', animal_code: 'PHS-002', legacy_slug: 'bella', name: 'Bella', species: 'Dog', breed: null, gender: 'Female', age: null, health: null, description: 'Recovered after rescue', adoptedNote: null, current_status: 'recovering' },
      { id: 'a3', animal_code: 'PHS-003', legacy_slug: null, name: 'Rocky', species: 'Dog', breed: null, gender: 'Male', age: null, health: null, description: null, adoptedNote: 'Adopted by a loving family', current_status: 'adopted' },
    ];
    const db = {
      prepare(query: string) {
        sql.push(query);
        return {
          all: async () => ({ results: query.includes('FROM animals') ? animals : [{ animal_id: 'a1', public_url: 'https://media.example/milo.webp' }] }),
        };
      },
    };
    const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
    app.route('/animals', publicAnimalsRoutes);
    const response = await app.request('/animals', {}, { DB: db } as unknown as Bindings);
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { available: Array<{name:string;images:string[]}>; rescued: Array<{name:string}>; adopted: Array<{name:string}> } };
    expect(body.data.available.map((a) => a.name)).toEqual(['Milo']);
    expect(body.data.available[0].images).toEqual(['https://media.example/milo.webp']);
    expect(body.data.rescued.map((a) => a.name)).toEqual(['Bella']);
    expect(body.data.adopted.map((a) => a.name)).toEqual(['Rocky']);
    expect(sql[0]).toContain('is_published_public = 1');
    expect(sql[0]).toContain('deleted_at IS NULL');
    expect(response.headers.get('cache-control')).toContain('max-age=60');
  });
});
