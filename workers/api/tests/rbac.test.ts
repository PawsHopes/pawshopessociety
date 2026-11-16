import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { effectivePermissions, requirePermission } from '../src/middleware/rbac';
import type { AuthUser, Bindings, AppVariables } from '../src/types/env';
import { canUploadDocumentCategory } from '../src/services/documentAccess';

function makeUser(permissions: string[]): AuthUser {
  return {
    id: 'test-user',
    email: 'test@example.org',
    fullName: 'Test User',
    roleCode: 'volunteer',
    roleName: 'Volunteer',
    permissions,
  };
}

function makeApp(user: AuthUser) {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', user);
    await next();
  });
  app.get('/finance', requirePermission('finance:read'), (c) => c.text('allowed'));
  return app;
}

describe('API-side RBAC enforcement', () => {
  it('allows a request when the exact required permission is present', async () => {
    const app = makeApp(makeUser(['finance:read']));
    const response = await app.request('/finance');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('allowed');
  });

  it('denies access when a user has a different permission', async () => {
    const app = makeApp(makeUser(['animals:read']));
    const response = await app.request('/finance');
    expect(response.status).toBe(403);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('denies access when the user has no permissions', async () => {
    const app = makeApp(makeUser([]));
    const response = await app.request('/finance');
    expect(response.status).toBe(403);
  });
});


describe('equal Super Admin permissions', () => {
  const all = ['dashboard:read', 'animals:read', 'animals:write', 'animals:publish', 'finance:approve', 'finance:ledger', 'donations:verify', 'inventory:approve', 'adoption:approve', 'cms:publish', 'rescue:write', 'volunteers:write', 'users:manage', 'documents:private_read'];

  it('grants the same full permissions to both designated Super Admin accounts', () => {
    const infosec = effectivePermissions('super_admin', 'infosecayush@gmail.com', all);
    const primary = effectivePermissions('super_admin', 'hopezpaws@gmail.com', all);
    expect(infosec).toEqual(all);
    expect(primary).toEqual(all);
    expect(infosec).toEqual(primary);
  });

  it('keeps full permissions for the existing Society primary Super Admin', () => {
    expect(effectivePermissions('super_admin', 'hopezpaws@gmail.com', all)).toEqual(all);
  });

  it('keeps unlisted Super Admin accounts read-only', () => {
    const permissions = effectivePermissions('super_admin', 'yivam24770@jcaton.com', all);
    expect(permissions).toContain('animals:read');
    expect(permissions).not.toContain('animals:write');
    expect(permissions).not.toContain('users:manage');
  });

  it('does not elevate non-admin roles based on email', () => {
    expect(effectivePermissions('auditor', 'hopezpaws@gmail.com', ['animals:read'])).toEqual(['animals:read']);
  });
});
