import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { effectivePermissions, isTrustedSuperAdmin, requirePermission } from '../src/middleware/rbac';
import { adminUsersRoutes } from '../src/routes/admin/users';
import { adminJoinRoutes } from '../src/routes/admin/join';
import { adminModuleRoutes } from '../src/routes/admin/modules';
import { adminDocumentRoutes } from '../src/routes/admin/documents';
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


function makeUsersApp(user: AuthUser) {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', user);
    await next();
  });
  app.route('/users', adminUsersRoutes);
  app.route('/join', adminJoinRoutes);
  app.route('/modules', adminModuleRoutes);
  app.route('/', adminDocumentRoutes);
  return app;
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


describe('untrusted test-account user-management restrictions', () => {
  it('blocks an untrusted Super Admin from listing, creating, activating, or suspending ERP users', async () => {
    const email = 'yivam24770@jcaton.com';
    const permissions = effectivePermissions('super_admin', email, [
      'dashboard:read',
      'users:manage',
      'audit:read'
    ]);
    const user: AuthUser = {
      id: 'test-user-id',
      email,
      fullName: 'Untrusted Test User',
      roleCode: 'super_admin',
      roleName: 'Super Admin (Read-Only)',
      permissions,
    };
    const app = makeUsersApp(user);
    const headers = { 'Content-Type': 'application/json' };

    const writeResources = [
      'animals', 'rescue_cases', 'medical_records', 'vaccinations', 'veterinarians',
      'adoption_applications', 'foster_applications', 'adoption_agreements', 'donors',
      'donations', 'expenses', 'compliance_registrations', 'inventory_items',
      'stock_movements', 'suppliers', 'purchase_orders', 'volunteers',
      'volunteer_tasks', 'website_content'
    ];
    const protectedActions = [
      '/join/applications/application-id/approve',
      '/join/applications/application-id/access-sync',
      '/modules/foster_applications/application-id/activate',
      '/modules/foster_applications/application-id/complete',
      '/modules/animals/animal-id/publish',
      '/modules/cms/content-id/publish',
      '/modules/purchase_orders/po-id/order',
      '/modules/purchase_orders/po-id/cancel',
      '/modules/purchase_orders/po-id/receive',
      '/modules/expenses/expense-id/approve',
      '/modules/expenses/expense-id/reject',
      '/modules/expenses/expense-id/mark-paid',
      '/modules/stock_movements/movement-id/approve',
      '/modules/donations/donation-id/verify',
      '/modules/attachments/animals/animal-id',
      '/documents/private-doc-id/signed-url',
    ];

    const responses = await Promise.all([
      app.request('/users'),
      app.request('/users', { method: 'POST', headers, body: JSON.stringify({ email: 'new@example.org', fullName: 'New User', roleCode: 'auditor' }) }),
      app.request('/users/target-user', { method: 'PATCH', headers, body: JSON.stringify({ status: 'active' }) }),
      app.request('/users/target-user', { method: 'PATCH', headers, body: JSON.stringify({ status: 'suspended' }) }),
      app.request('/users/target-user', { method: 'PATCH', headers, body: JSON.stringify({ roleCode: 'super_admin' }) }),
      ...writeResources.map((resource) => app.request('/modules/' + resource, { method: 'POST', headers, body: '{}' })),
      ...protectedActions.map((path) => app.request(path, { method: 'POST', headers, body: '{}' })),
    ]);

    expect(responses.every((response) => response.status === 403)).toBe(true);
  });
});

describe('trusted Super Admin permission boundary', () => {
  const all = ['dashboard:read', 'animals:read', 'animals:write', 'animals:publish', 'finance:approve', 'finance:ledger', 'donations:verify', 'inventory:approve', 'adoption:approve', 'cms:publish', 'rescue:write', 'volunteers:write', 'users:manage', 'documents:private_read'];

  it('recognizes only the two explicitly configured trusted administrator emails', () => {
    expect(isTrustedSuperAdmin('hopezpaws@gmail.com')).toBe(true);
    expect(isTrustedSuperAdmin('INFOSE CAYUSH@gmail.com')).toBe(false);
    expect(isTrustedSuperAdmin('infosecayush@gmail.com')).toBe(true);
    expect(isTrustedSuperAdmin('yivam24770@jcaton.com')).toBe(false);
    expect(isTrustedSuperAdmin('unlisted@example.org')).toBe(false);
  });

  it('grants the same complete permission set to both explicitly trusted administrators', () => {
    expect(effectivePermissions('super_admin', 'hopezpaws@gmail.com', all)).toEqual(all);
    expect(effectivePermissions('super_admin', 'infosecayush@gmail.com', all)).toEqual(all);
  });

  it('keeps any other Super Admin identity read-only, including known and future test accounts', () => {
    for (const email of ['yivam24770@jcaton.com', 'unlisted@example.org', 'attacker@example.net']) {
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
    expect(effectivePermissions('auditor', 'infosecayush@gmail.com', ['animals:read'])).toEqual(['animals:read']);
  });
});
