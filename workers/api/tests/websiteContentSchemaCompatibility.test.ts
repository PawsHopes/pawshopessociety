import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppVariables, AuthUser, Bindings } from '../src/types/env';
import { adminModuleRoutes } from '../src/routes/admin/modules';

vi.mock('../src/services/audit', () => ({
  appendAuditLog: vi.fn(async () => undefined),
}));

type CapturedStatement = { sql: string; values: unknown[] };

function makeApp(schemaColumns: string[]) {
  const statements: CapturedStatement[] = [];
  const actor: AuthUser = {
    id: 'uat-admin',
    email: 'hopezpaws@gmail.com',
    fullName: 'UAT Super Admin',
    roleCode: 'super_admin',
    roleName: 'Super Admin',
    permissions: ['cms:read', 'cms:write', 'cms:publish'],
  };

  const DB = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            sql,
            values,
            first: async () => {
              if (sql.includes('COALESCE(MAX(version_number)')) return { next_version: 1 };
              return null;
            },
            run: async () => {
              statements.push({ sql, values });
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
        all: async () => {
          if (sql.includes('PRAGMA table_info(website_content)')) {
            return { results: schemaColumns.map((name) => ({ name })) };
          }
          return { results: [] };
        },
      };
    },
    batch: async (prepared: unknown[]) => {
      for (const statement of prepared as CapturedStatement[]) statements.push(statement);
      return [{ success: true, meta: { changes: 1 } }];
    },
  };

  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', actor);
    await next();
  });
  app.route('/modules', adminModuleRoutes);

  return { app, env: { DB } as unknown as Bindings, statements };
}

async function createCmsDraft(app: ReturnType<typeof makeApp>['app'], env: Bindings) {
  return app.request(
    '/modules/website_content',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_slug: 'adopt.html',
        section_key: 'after_intro',
        title: 'UAT CMS draft',
        body_json: JSON.stringify({ content: 'Synthetic CMS test' }),
      }),
    },
    env,
  );
}

describe('website_content schema compatibility', () => {
  it('supplies required visual-builder columns when they exist in staging', async () => {
    const schemaColumns = [
      'id', 'page_slug', 'section_key', 'block_id', 'title', 'body_json',
      'status', 'version_number', 'updated_by', 'block_type', 'sort_order',
    ];
    const { app, env, statements } = makeApp(schemaColumns);

    const response = await createCmsDraft(app, env);
    const insert = statements.find((statement) => statement.sql.includes('INSERT INTO website_content'));

    expect(response.status).toBe(201);
    if (!insert) throw new Error('CMS insert statement was not captured');
    expect(insert.sql).toContain('block_id');
    expect(insert.sql).toContain('block_type');

    const columns = insert.sql.match(/\(([^)]+)\) VALUES/)?.[1].split(', ').map((value) => value.trim()) || [];
    const blockIdIndex = columns.indexOf('block_id');
    const blockTypeIndex = columns.indexOf('block_type');
    expect(blockIdIndex).toBeGreaterThanOrEqual(0);
    expect(blockTypeIndex).toBeGreaterThanOrEqual(0);
    expect(String(insert.values[blockIdIndex] || '')).not.toBe('');
    expect(insert.values[blockTypeIndex]).toBe('content');
  });

  it('does not reference legacy columns when they are absent from production schema', async () => {
    const schemaColumns = [
      'id', 'page_slug', 'section_key', 'title', 'body_json',
      'status', 'version_number', 'updated_by', 'sort_order',
    ];
    const { app, env, statements } = makeApp(schemaColumns);

    const response = await createCmsDraft(app, env);
    const insert = statements.find((statement) => statement.sql.includes('INSERT INTO website_content'));

    expect(response.status).toBe(201);
    expect(insert).toBeDefined();
    expect(insert?.sql).not.toContain('block_id');
    expect(insert?.sql).not.toContain('block_type');
  });
});
