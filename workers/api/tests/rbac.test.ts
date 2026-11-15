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


describe('primary administrator privilege boundary', () => {
  const all = ['dashboard:read', 'animals:read', 'animals:write', 'finance:approve', 'finance:ledger', 'donations:verify', 'inventory:approve', 'adoption:approve', 'cms:publish', 'rescue:write', 'volunteers:write', 'users:manage', 'documents:private_read'];

  it('makes a secondary Super Admin read-only', () => {
    const permissions = effectivePermissions('super_admin', 'yivam24770@jcaton.com', all);
    expect(permissions).toContain('animals:read');
    expect(permissions).toContain('dashboard:read');
    expect(permissions.every((code) => code.endsWith(':read') || code === 'dashboard:read')).toBe(true);
    expect(permissions).not.toContain('animals:write');
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
  });

  it('keeps full Super Admin permissions for the primary account only', () => {
    expect(effectivePermissions('super_admin', 'hopezpaws@gmail.com', all)).toEqual(all);
  });

  it('does not elevate non-admin roles even when the email is the primary email', () => {
    expect(effectivePermissions('auditor', 'hopezpaws@gmail.com', ['animals:read'])).toEqual(['animals:read']);
  });

  it('does not let a secondary Super Admin upload private documents via role bypass', () => {
    const permissions = effectivePermissions('super_admin', 'yivam24770@jcaton.com', [
      'dashboard:read', 'medical:read', 'medical:write', 'documents:private_read'
    ]);
    const secondary = { ...makeUser(permissions), roleCode: 'super_admin' as const };
    expect(canUploadDocumentCategory(secondary, 'vet_bill')).toBe(false);
  });
});
