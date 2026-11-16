import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { adminModuleRoutes } from '../src/routes/admin/modules';
import type { Bindings, AppVariables } from '../src/types/env';

function makeApp(status: 'draft' | 'published' | 'archived') {
  const updates: string[] = [];
  const existing = { id: 'cms-1', page_slug: 'index.html', section_key: 'top_of_page', status, version_number: 1 };
  const DB = {
    prepare(query: string) {
      return {
        bind() {
          return {
            first: async () => existing,
            run: async () => {
              updates.push(query);
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', {
      id: 'cms-admin',
      email: 'infosecayush@gmail.com',
      fullName: 'CMS Admin',
      roleCode: 'super_admin',
      roleName: 'Super Admin',
      permissions: ['cms:publish'],
    });
    await next();
  });
  app.route('/modules', adminModuleRoutes);
  return { app, env: { DB } as unknown as Bindings, updates };
}

describe('CMS draft and published section archiving', () => {
  it('allows a designated Super Admin to archive an obsolete draft', async () => {
    const { app, env, updates } = makeApp('draft');
    const response = await app.request('/modules/cms/cms-1/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: false }),
    }, env);
    expect(response.status).toBe(200);
    expect((await response.json() as { data: { status: string } }).data.status).toBe('archived');
    expect(updates[0]).toContain("status IN ('draft', 'published')");
  });

  it('treats already archived CMS versions as an idempotent success', async () => {
    const { app, env, updates } = makeApp('archived');
    const response = await app.request('/modules/cms/cms-1/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: false }),
    }, env);
    expect(response.status).toBe(200);
    expect((await response.json() as { data: { unchanged: boolean } }).data.unchanged).toBe(true);
    expect(updates).toHaveLength(0);
  });
});
