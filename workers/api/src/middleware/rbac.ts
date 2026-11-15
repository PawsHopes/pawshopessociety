import { createMiddleware } from 'hono/factory';
import type { Bindings, AppVariables, AuthUser, RoleCode } from '../types/env';

const FULL_SUPER_ADMIN_EMAILS = new Set([
  'hopezpaws@gmail.com',
  'infosecayush@gmail.com',
  'yivam24770@jcaton.com',
]);

export function effectivePermissions(roleCode: RoleCode, email: string, allPermissions: string[]): string[] {
  // Full Super Admin privileges are limited to the explicitly designated Society accounts.
  if (roleCode === 'super_admin' && !FULL_SUPER_ADMIN_EMAILS.has(email.toLowerCase())) {
    return allPermissions.filter((code) => code.endsWith(':read') || code === 'dashboard:read');
  }
  return allPermissions;
}

export const loadRbacUser = createMiddleware<{
  Bindings: Bindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const email = c.get('authEmail');
  if (!email) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated request.' } },
      401
    );
  }

  // Bootstrap first Super Admin in development if configured and users table is empty
  if (
    c.env.ENVIRONMENT === 'development' &&
    c.env.DEV_BOOTSTRAP_ADMIN_EMAIL &&
    email === c.env.DEV_BOOTSTRAP_ADMIN_EMAIL.toLowerCase().trim()
  ) {
    const countRow = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first<{
      cnt: number;
    }>();
    if ((countRow?.cnt ?? 0) === 0) {
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, full_name, role_id, status)
         VALUES (?, ?, 'Bootstrap Super Admin', 'role_super_admin', 'active')`
      )
        .bind(crypto.randomUUID(), email)
        .run();
    }
  }

  const userRow = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.status, r.code as role_code, r.name as role_name, r.id as role_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`
  )
    .bind(email)
    .first<{
      id: string;
      email: string;
      full_name: string;
      status: string;
      role_code: RoleCode;
      role_name: string;
      role_id: string;
    }>();

  if (!userRow) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Your email is not registered in the Paw\'s Hopez ERP. Contact a Super Admin.',
        },
      },
      403
    );
  }

  if (userRow.status !== 'active') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Account status is '${userRow.status}'. Access denied.`,
        },
      },
      403
    );
  }

  const permResult = await c.env.DB.prepare(
    `SELECT p.code
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`
  )
    .bind(userRow.role_id)
    .all<{ code: string }>();

  const allPermissions = (permResult.results || []).map((r) => r.code);
  const permissions = effectivePermissions(userRow.role_code, userRow.email, allPermissions);

  const authUser: AuthUser = {
    id: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    roleCode: userRow.role_code,
    roleName: userRow.role_code === 'super_admin' && !FULL_SUPER_ADMIN_EMAILS.has(userRow.email.toLowerCase()) ? 'Super Admin (Read-Only)' : userRow.role_name,
    permissions,
  };

  c.set('authUser', authUser);
  return next();
});

export function requirePermission(permission: string) {
  return createMiddleware<{
    Bindings: Bindings;
    Variables: AppVariables;
  }>(async (c, next) => {
    const user = c.get('authUser');
    if (!user || !user.permissions.includes(permission)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Missing required permission: ${permission}`,
          },
        },
        403
      );
    }
    return next();
  });
}
