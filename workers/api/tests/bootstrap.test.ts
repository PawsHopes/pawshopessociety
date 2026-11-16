import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { bootstrapRoutes } from '../src/routes/bootstrap';
import type { Bindings, AppVariables } from '../src/types/env';

function makeBootstrapApp(authEmail: string) {
  const batches: unknown[][] = [];
  const db = {
    prepare: (sql: string) => {
      const statement = {
        first: async () => sql.includes("role_id = 'role_super_admin'") ? null : null,
        all: async () => ({ results: [] }),
        bind: (..._values: unknown[]) => statement,
      };
      return statement;
    },
    batch: async (statements: unknown[]) => { batches.push(statements); return []; },
  };
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authEmail', authEmail);
    await next();
  });
  app.route('/bootstrap', bootstrapRoutes);
  return { app, batches, env: {
    ENVIRONMENT: 'staging',
    STAGING_BOOTSTRAP_ADMIN_EMAIL: 'hopezpaws@gmail.com',
    DB: db,
  } as unknown as Bindings };
}

describe('staging Super Admin bootstrap', () => {
  it('creates both trusted Super Admins with the same role in one audited batch', async () => {
    const { app, batches, env } = makeBootstrapApp('hopezpaws@gmail.com');
    const response = await app.request('/bootstrap/super-admin', { method: 'POST' }, env);
    expect(response.status).toBe(201);
    const body = await response.json() as { success: boolean; data: { administrators: string[]; equalPermissions: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.administrators).toEqual(['hopezpaws@gmail.com', 'infosecayush@gmail.com']);
    expect(body.data.equalPermissions).toBe(true);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(4);
  });

  it('does not allow the secondary account or an untrusted identity to initialize bootstrap', async () => {
    for (const email of ['infosecayush@gmail.com', 'yivam24770@jcaton.com']) {
      const { app, batches, env } = makeBootstrapApp(email);
      const response = await app.request('/bootstrap/super-admin', { method: 'POST' }, env);
      expect(response.status).toBe(403);
      expect(batches).toHaveLength(0);
    }
  });
});
