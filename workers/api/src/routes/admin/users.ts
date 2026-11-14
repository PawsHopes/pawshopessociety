
import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, AppVariables } from '../../types/env';
import { requirePermission } from '../../middleware/rbac';
import { appendAuditLog } from '../../services/audit';

export const adminUsersRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

const ROLE_CODES = [
  'super_admin',
  'finance_manager',
  'vet_staff',
  'rescue_coord',
  'adoption_coord',
  'volunteer',
  'auditor',
] as const;

const createUserSchema = z.object({
  email: z.string().email().max(180),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(25).nullable().optional(),
  roleCode: z.enum(ROLE_CODES),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(25).nullable().optional(),
  roleCode: z.enum(ROLE_CODES).optional(),
  status: z.enum(['invited', 'active', 'suspended']).optional(),
});

adminUsersRoutes.get(
  '/',
  requirePermission('users:manage'),
  async (c) => {
    const actor = c.get('authUser');

    if (actor.roleCode !== 'super_admin') {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only a Super Admin can manage users.' }
      }, 403);
    }

    const users = await c.env.DB.prepare(`
      SELECT u.id, u.email, u.full_name as fullName,
        u.phone, u.status, u.last_login_at as lastLoginAt,
        u.created_at as createdAt,
        r.code as roleCode, r.name as roleName
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.created_at DESC
    `).all();

    const roles = await c.env.DB.prepare(
      'SELECT id, code, name, description FROM roles ORDER BY rowid'
    ).all();

    return c.json({
      success: true,
      data: {
        users: users.results || [],
        roles: roles.results || []
      }
    });
  }
);

adminUsersRoutes.post(
  '/',
  requirePermission('users:manage'),
  async (c) => {
    const actor = c.get('authUser');

    if (actor.roleCode !== 'super_admin') {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only a Super Admin can create users.' }
      }, 403);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues
        }
      }, 400);
    }

    const email = parsed.data.email.toLowerCase().trim();

    const role = await c.env.DB.prepare(
      'SELECT id, code FROM roles WHERE code = ?'
    ).bind(parsed.data.roleCode).first<{ id: string; code: string }>();

    if (!role) {
      return c.json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid role.' }
      }, 400);
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return c.json({
        success: false,
        error: { code: 'CONFLICT', message: 'User already exists.' }
      }, 409);
    }

    const id = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO users (
        id, email, full_name, phone, role_id, status
      ) VALUES (?, ?, ?, ?, ?, 'invited')
    `).bind(
      id,
      email,
      parsed.data.fullName.trim(),
      parsed.data.phone ?? null,
      role.id
    ).run();

    await appendAuditLog(c, {
      action: 'USER_INVITED',
      entityType: 'users',
      entityId: id,
      after: {
        email,
        roleCode: role.code,
        status: 'invited'
      }
    });

    return c.json({
      success: true,
      data: {
        id,
        email,
        roleCode: role.code,
        status: 'invited'
      }
    }, 201);
  }
);

adminUsersRoutes.patch(
  '/:id',
  requirePermission('users:manage'),
  async (c) => {
    const actor = c.get('authUser');

    if (actor.roleCode !== 'super_admin') {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only a Super Admin can update users.' }
      }, 403);
    }

    const targetId = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues
        }
      }, 400);
    }

    if (Object.keys(parsed.data).length === 0) {
      return c.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No fields supplied.' }
      }, 400);
    }

    const existing = await c.env.DB.prepare(`
      SELECT u.id, u.email, u.full_name, u.phone,
        u.status, u.role_id, r.code as role_code
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
    `).bind(targetId).first<{
      id: string;
      email: string;
      full_name: string;
      phone: string | null;
      status: string;
      role_id: string;
      role_code: string;
    }>();

    if (!existing) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found.' }
      }, 404);
    }

    if (
      targetId === actor.id &&
      (parsed.data.roleCode !== undefined || parsed.data.status !== undefined)
    ) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot change your own role or status.' }
      }, 403);
    }

    let nextRoleId = existing.role_id;
    let nextRoleCode = existing.role_code;

    if (parsed.data.roleCode !== undefined) {
      const role = await c.env.DB.prepare(
        'SELECT id, code FROM roles WHERE code = ?'
      ).bind(parsed.data.roleCode).first<{ id: string; code: string }>();

      if (!role) {
        return c.json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid role.' }
        }, 400);
      }

      nextRoleId = role.id;
      nextRoleCode = role.code;
    }

    const nextStatus = parsed.data.status ?? existing.status;

    const removingLastAdmin =
      existing.role_code === 'super_admin' &&
      existing.status === 'active' &&
      (nextRoleCode !== 'super_admin' || nextStatus !== 'active');

    if (removingLastAdmin) {
      const count = await c.env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE r.code = 'super_admin' AND u.status = 'active'
      `).first<{ count: number }>();

      if ((count?.count ?? 0) <= 1) {
        return c.json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot remove the last active Super Admin.'
          }
        }, 403);
      }
    }

    await c.env.DB.prepare(`
      UPDATE users SET
        full_name = CASE WHEN ? = 1 THEN ? ELSE full_name END,
        phone = CASE WHEN ? = 1 THEN ? ELSE phone END,
        role_id = CASE WHEN ? = 1 THEN ? ELSE role_id END,
        status = CASE WHEN ? = 1 THEN ? ELSE status END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).bind(
      parsed.data.fullName !== undefined ? 1 : 0,
      parsed.data.fullName?.trim() ?? null,
      parsed.data.phone !== undefined ? 1 : 0,
      parsed.data.phone ?? null,
      parsed.data.roleCode !== undefined ? 1 : 0,
      nextRoleId,
      parsed.data.status !== undefined ? 1 : 0,
      parsed.data.status ?? null,
      targetId
    ).run();

    await appendAuditLog(c, {
      action: 'USER_UPDATED',
      entityType: 'users',
      entityId: targetId,
      before: {
        roleCode: existing.role_code,
        status: existing.status
      },
      after: {
        roleCode: nextRoleCode,
        status: nextStatus
      }
    });

    return c.json({
      success: true,
      data: { id: targetId, updated: true }
    });
  }
);
