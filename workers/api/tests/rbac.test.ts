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


describe('primary administrator permission boundary', () => {
  const all = ['dashboard:read', 'animals:read', 'animals:write', 'animals:publish', 'finance:approve', 'finance:ledger', 'donations:verify', 'inventory:approve', 'adoption:approve', 'cms:publish', 'rescue:write', 'volunteers:write', 'users:manage', 'documents:private_read'];

  it('grants the complete permission set only to the Society primary administrator', () => {
    expect(effectivePermissions('super_admin', 'hopezpaws@gmail.com', all)).toEqual(all);
  });

  it('keeps every secondary Super Admin read-only, including known tester accounts', () => {
    for (const email of ['infosecayush@gmail.com', 'yivam24770@jcaton.com', 'unlisted@example.org']) {
      const permissions = effectivePermissions('super_admin', email, all);
      expect(permissions.every((code) => code.endsWith(':read') || code === 'dashboard:read')).toBe(true);
      expect(permissions).not.toContain('animals:write');
      expect(permissions).not.toContain('animals:publish');
      expect(permissions).not.toContain('finance:approve');
      expect(permissions).not.toContain('finance:ledger');
      expect(permissions).not.toContain('donations:verify');
      expect(permissions).not.toContain('inventory:approve');
      expect(permissions).not.toContain('adoption:approve');
      expect(permissions).not.toContain('cms:publish');
      expect(permissions).not.toContain('rescue:write');
      expect(permissions).not.toContain('volunteers:write');
      expect(permissions).not.toContain('users:manage');
      expect(permissions).not.toContain('documents:private_read');
    }
  });

  it('does not elevate non-admin roles based on email', () => {
    expect(effectivePermissions('auditor', 'hopezpaws@gmail.com', ['animals:read'])).toEqual(['animals:read']);
  });
});
