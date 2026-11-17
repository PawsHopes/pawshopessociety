import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppVariables, AuthUser, Bindings } from '../src/types/env';

vi.mock('../src/services/audit', () => ({
  appendAuditLog: vi.fn(async () => undefined),
}));

import { adminModuleRoutes } from '../src/routes/admin/modules';
import { publicAnimalsRoutes } from '../src/routes/public/animals';

type AnimalRow = Record<string, unknown> & {
  id: string;
  animal_code: string;
  name: string;
  species: string;
  gender: string;
  current_status: string;
  is_adoption_eligible: number;
  is_published_public: number;
  public_description: string | null;
  deleted_at: string | null;
};

function makeApp() {
  let animal: AnimalRow | null = null;
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const actor: AuthUser = {
    id: 'uat-super-admin',
    email: 'infosecayush@gmail.com',
    fullName: 'UAT Society Super Admin',
    roleCode: 'super_admin',
    roleName: 'Super Admin',
    permissions: ['animals:read', 'animals:write', 'animals:publish', 'adoption:approve', 'rescue:write', 'medical:write'],
  };

  const DB = {
    prepare(sql: string) {
      const statement = {
        sql,
        values: [] as unknown[],
        first: async () => {
          if (sql.includes('SELECT * FROM animals WHERE id = ?')) return animal;
          if (sql.includes('SELECT id, is_published_public, is_adoption_eligible')) return animal;
          return null;
        },
        all: async () => {
          if (sql.includes('FROM animals') && sql.includes('is_published_public = 1')) {
            if (!animal || animal.is_published_public !== 1 || animal.deleted_at) return { results: [] };
            return { results: [{
              id: animal.id,
              animal_code: animal.animal_code,
              legacy_slug: null,
              name: animal.name,
              species: animal.species,
              breed: animal.breed ?? null,
              gender: animal.gender,
              age: animal.estimated_age_text ?? null,
              health: animal.health_summary ?? null,
              healthConditions: animal.health_conditions ?? null,
              mobilityStatus: animal.mobility_status ?? 'unknown',
              specialCareNotes: animal.special_care_notes ?? null,
              description: animal.public_description,
              adoptedNote: animal.adopted_note ?? null,
              current_status: animal.current_status,
            }] };
          }
          if (sql.includes('FROM animal_media')) return { results: [] };
          return { results: [] };
        },
        run: async () => {
          statements.push({ sql, values: statement.values });
          if (sql.startsWith('UPDATE animals SET is_published_public')) {
            if (animal) animal.is_published_public = Number(statement.values[0]);
          } else if (sql.startsWith('UPDATE animals SET')) {
            if (animal) {
              const setClause = sql.slice('UPDATE animals SET '.length).split(' WHERE ')[0] || '';
              const fields = setClause.split(', ').filter((part) => !part.includes('strftime'));
              fields.forEach((part, index) => {
                const field = part.split(' = ')[0];
                if (animal && field) animal[field] = statement.values[index];
              });
            }
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
      return {
        ...statement,
        bind(...values: unknown[]) {
          statement.values = values;
          return statement;
        },
      };
    },
    batch: async (prepared: Array<{ sql: string; values: unknown[] }>) => {
      for (const statement of prepared) {
        statements.push(statement);
        if (statement.sql.startsWith('INSERT INTO animals')) {
          const columnList = statement.sql.match(/\\(([^)]+)\\) VALUES/)?.[1] || '';
          const columns = columnList.split(', ').map((column) => column.trim());
          animal = Object.fromEntries(columns.map((column, index) => [column, statement.values[index]])) as AnimalRow;
          animal.is_published_public = Number(animal.is_published_public || 0);
          animal.deleted_at = null;
        }
      }
      return [{ success: true, meta: { changes: 1 } }];
    },
  };

  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', actor);
    await next();
  });
  app.route('/modules', adminModuleRoutes);
  app.route('/public/animals', publicAnimalsRoutes);
  return { app, env: { DB } as unknown as Bindings, statements, getAnimal: () => animal };
}

beforeEach(() => vi.clearAllMocks());

describe('animal create, edit, publish and public feed workflow', () => {
  it('creates an adoption-ready animal, edits it, publishes it and exposes the edited record publicly', async () => {
    const { app, env, getAnimal, statements } = makeApp();

    const created = await app.request('/modules/animals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animal_code: 'UAT-ANIMAL-001',
        name: 'UAT Puppy',
        species: 'Dog',
        gender: 'Female',
        current_status: 'available_for_adoption',
        is_adoption_eligible: 1,
        public_description: 'Synthetic adoption listing for automated staging UAT.',
      }),
    }, env);

    expect(created.status).toBe(201);
    const createdPayload = await created.json() as { data: { id: string } };
    const animalId = createdPayload.data.id;
    expect(getAnimal()?.name).toBe('UAT Puppy');
    expect(getAnimal()?.is_published_public).toBe(0);

    const edited = await app.request('/modules/animals/' + animalId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'UAT Puppy Edited', public_description: 'Updated synthetic adoption listing.' }),
    }, env);
    expect(edited.status).toBe(200);
    expect(getAnimal()?.name).toBe('UAT Puppy Edited');

    const published = await app.request('/modules/animals/' + animalId + '/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: true }),
    }, env);
    expect(published.status).toBe(200);
    expect(getAnimal()?.is_published_public).toBe(1);

    const feed = await app.request('/public/animals', {}, env);
    expect(feed.status).toBe(200);
    const payload = await feed.json() as { data: { available: Array<{ id: string; name: string; description: string }> } };
    expect(payload.data.available).toEqual([expect.objectContaining({
      id: animalId,
      name: 'UAT Puppy Edited',
      description: 'Updated synthetic adoption listing.',
    })]);
    expect(statements.some((entry) => entry.sql.includes('INSERT INTO animals'))).toBe(true);
    expect(statements.some((entry) => entry.sql.includes('UPDATE animals SET is_published_public'))).toBe(true);
  });

  it('does not publish an ineligible animal or a deleted animal', async () => {
    const { app, env, getAnimal } = makeApp();
    const created = await app.request('/modules/animals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animal_code: 'UAT-ANIMAL-002',
        name: 'UAT Private Puppy',
        species: 'Dog',
        current_status: 'recovering',
        public_description: '',
      }),
    }, env);
    expect(created.status).toBe(201);
    const id = (await created.json() as { data: { id: string } }).data.id;

    const blocked = await app.request('/modules/animals/' + id + '/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: true }),
    }, env);
    expect(blocked.status).toBe(409);
    expect(getAnimal()?.is_published_public).toBe(0);
  });

  it('rejects direct creation of an adopted or fostered animal', async () => {
    const { app, env } = makeApp();
    const response = await app.request('/modules/animals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animal_code: 'UAT-ANIMAL-003',
        name: 'UAT Invalid Lifecycle',
        species: 'Dog',
        current_status: 'adopted',
      }),
    }, env);
    expect(response.status).toBe(409);
  });
});
