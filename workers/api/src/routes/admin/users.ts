import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, AppVariables } from '../../types/env';
import { requirePermission } from '../../middleware/rbac';
import { appendAuditLog } from '../../services/audit';

export const adminUsersRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

const createUserSchema = z.object({
  email: z.string().email().max(180),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(25).optional(),
  roleCode: z.enum([
    'super_admin',
    'finance_manager',
    'vet_staff',
    'rescue_coord',
    'adoption_coord',
    'volunteer',
    'auditor',
  ]),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(25).nullable().optional(),
  roleCode: z
    .enum([
      'super_admin',
      'finance_manager',
      'vet_staff',
      'rescue_coord',
      'adoption_coord',
      'volunteer',
      'auditor',
    ])
    .optional(),
  status: z.enum(['invited', 'active', 'suspended']).optional(),
});

adminUsersRoutes.get('/', requirePermission('users:manage'), async (c) => {
  const res = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.full_name as fullName, u.phone, u.status,
            u.last_login_at as lastLoginAt, u.created_at as createdAt,
            r.code as roleCode, r.name as roleName
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC`
  ).all();

  const rolesRes = await c.env.DB.prepare(
    `SELECT id, code, name, description FROM roles ORDER BY rowid ASC`
  ).all();

  return c.json({
    success: true,
    data: {
      users: res.results || [],
      roles: rolesRes.results || [],
    },
  });
});

adminUsersRoutes.post('/', requirePermission('users:manage'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user payload',
          details: parsed.error.issues,
        },
      },
      400
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const role = await c.env.DB.prepare('SELECT id, code, name FROM roles WHERE code = ?')
    .bind(parsed.data.roleCode)
    .first<{ id: string; code: string; name: string }>();

  if (!role) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid roleCode' } },
      400
    );
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (existing) {
    return c.json(
      {
        success: false,
        error: { code: 'CONFLICT', message: 'A user with this email already exists.' },
      },
      409
    );
  }

  const newId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, full_name, phone, role_id, status)
     VALUES (?, ?, ?, ?, ?, 'active')`
  )
    .bind(newId, email, parsed.data.fullName.trim(), parsed.data.phone ?? null, role.id)
    .run();

  await appendAuditLog(c, {
    action: 'USER_CREATED',
    entityType: 'users',
    entityId: newId,
    after: { email, fullName: parsed.data.fullName, roleCode: role.code },
  });

  return c.json({ success: true, data: { id: newId, email, roleCode: role.code } }, 201);
});

adminUsersRoutes.patch('/:id', requirePermission('users:manage'), async (c) => {
  const targetId = c.req.param('id');
  const actor = c.get('authUser');

  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update payload',
          details: parsed.error.issues,
        },
      },
      400
    );
  }

  if (targetId === actor.id && parsed.data.status === 'suspended') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot suspend your own Super Admin account.' },
      },
      403
    );
  }

  const existing = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.phone, u.status, r.code as role_code
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
  )
    .bind(targetId)
    .first<Record<string, unknown>>();

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } },
      404
    );
  }

  let nextRoleId: string | null = null;
  if (parsed.data.roleCode) {
    const role = await c.env.DB.prepare('SELECT id FROM roles WHERE code = ?')
      .bind(parsed.data.roleCode)
      .first<{ id: string }>();
    if (!role) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid roleCode' } },
        400
      );
    }
    nextRoleId = role.id;
  }

  await c.env.DB.prepare(
    `UPDATE users SET
      full_name = COALESCE(?, full_name),
      phone = COALESCE(?, phone),
      role_id = COALESCE(?, role_id),
      status = COALESCE(?, status),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  )
    .bind(
      parsed.data.fullName ?? null,
      parsed.data.phone ?? null,
      nextRoleId,
      parsed.data.status ?? null,
      targetId
    )
    .run();

  await appendAuditLog(c, {
    action: 'USER_UPDATED',
    entityType: 'users',
    entityId: targetId,
    before: existing,
    after: parsed.data,
  });

  return c.json({ success: true, data: { id: targetId, updated: true } });
});
