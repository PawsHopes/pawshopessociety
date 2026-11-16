import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { adminUsersRoutes } from '../src/routes/admin/users';
import { adminJoinRoutes } from '../src/routes/admin/join';
import { adminModuleRoutes } from '../src/routes/admin/modules';
import type { AuthUser, Bindings, AppVariables } from '../src/types/env';

function makeApp(user?: AuthUser) {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  const secondaryAdmin: AuthUser = {
    id: 'secondary-admin',
    email: 'yivam24770@jcaton.com',
    fullName: 'Secondary Administrator',
    roleCode: 'super_admin',
    roleName: 'Super Admin (Read-Only)',
    // Deliberately simulate an accidentally over-granted permission. The route
    // itself must still enforce the primary administrator boundary.
    permissions: ['users:manage', 'dashboard:read'],
  };
  app.use('*', async (c, next) => {
    c.set('authUser', user ?? secondaryAdmin);
    await next();
  });
  app.route('/users', adminUsersRoutes);
  app.route('/join', adminJoinRoutes);
  app.route('/modules', adminModuleRoutes);
  return app;
}

describe('primary administrator-only controls', () => {
  it('blocks a secondary Super Admin from viewing the user directory', async () => {
    const response = await makeApp().request('/users');
    expect(response.status).toBe(403);
  });

  it('blocks a secondary Super Admin from creating an ERP user', async () => {
    const response = await makeApp().request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.org', fullName: 'New User', roleCode: 'auditor' }),
    });
    expect(response.status).toBe(403);
  });

  it('blocks a secondary Super Admin from changing another account role or status', async () => {
    const response = await makeApp().request('/users/user-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleCode: 'auditor', status: 'active' }),
    });
    expect(response.status).toBe(403);
  });

  it('blocks a secondary Super Admin from creating join links or reviewing applicants', async () => {
    const app = makeApp();
    const links = await app.request('/join/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Unauthorized link' }),
    });
    const applications = await app.request('/join/applications?status=all');
    expect(links.status).toBe(403);
    expect(applications.status).toBe(403);
  });

  it('blocks a secondary Super Admin from issuing donation receipts', async () => {
    const response = await makeApp().request('/modules/donations/donation-123/receipt', { method: 'POST' });
    expect(response.status).toBe(403);
  });

  it('blocks a secondary Super Admin from applicant approval and Access grants', async () => {
    const app = makeApp();
    const approval = await app.request('/join/applications/app-123/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleCode: 'volunteer' }),
    });
    const retry = await app.request('/join/applications/app-123/access-sync', { method: 'POST' });
    const rejection = await app.request('/join/applications/app-123/reject', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'test' }),
    });
    expect(approval.status).toBe(403);
    expect(retry.status).toBe(403);
    expect(rejection.status).toBe(403);
  });
  it('allows the second designated Society Super Admin to access user and join administration', async () => {
    const designatedAdmin: AuthUser = {
      id: 'equal-admin',
      email: 'infosecayush@gmail.com',
      fullName: 'Designated Super Admin',
      roleCode: 'super_admin',
      roleName: 'Super Admin',
      permissions: ['users:manage'],
    };
    const app = makeApp(designatedAdmin);
    const DB = {
      prepare: () => ({
        all: async () => ({ results: [] }),
      }),
    };
    const users = await app.request('/users', {}, { DB } as unknown as Bindings);
    const applications = await app.request('/join/applications?status=all', {}, { DB } as unknown as Bindings);
    expect(users.status).toBe(200);
    expect(applications.status).toBe(200);
  });

});
