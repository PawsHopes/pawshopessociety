import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings, AppVariables } from '../../types/env';
import { requirePermission } from '../../middleware/rbac';
import { appendAuditLog } from '../../services/audit';

export const adminJoinRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

const ROLE_CODES = [
  'finance_manager',
  'vet_staff',
  'rescue_coord',
  'adoption_coord',
  'volunteer',
  'auditor',
] as const;

const createLinkSchema = z.object({
  label: z.string().trim().min(2).max(100).default('Society join link'),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

const approveSchema = z.object({
  roleCode: z.enum(ROLE_CODES),
});

const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

function requireSuperAdmin(c: any) {
  return c.get('authUser')?.roleCode === 'super_admin';
}

function createRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

adminJoinRoutes.use('*', requirePermission('users:manage'));

adminJoinRoutes.post('/links', async (c) => {
  if (!requireSuperAdmin(c)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the Super Admin can create join links.' } }, 403);
  }

  const parsed = createLinkSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid link settings.' } }, 400);
  }

  const token = createRawToken();
  const tokenHash = await hashToken(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86400000).toISOString();

  await c.env.DB.prepare(`
    INSERT INTO join_links (id, token_hash, label, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, tokenHash, parsed.data.label, c.get('authUser').id, expiresAt).run();

  await appendAuditLog(c, {
    action: 'JOIN_LINK_CREATED',
    entityType: 'join_links',
    entityId: id,
    after: { label: parsed.data.label, expiresAt }
  });

  const apiOrigin = new URL(c.req.url).origin;
  const joinUrl = `${apiOrigin}/api/v1/public/join/${token}`;

  return c.json({
    success: true,
    data: { id, label: parsed.data.label, expiresAt, joinUrl }
  }, 201);
});

adminJoinRoutes.get('/links', async (c) => {
  if (!requireSuperAdmin(c)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the Super Admin can view join links.' } }, 403);
  }

  const result = await c.env.DB.prepare(`
    SELECT l.id, l.label, l.expires_at AS expiresAt,
      l.revoked_at AS revokedAt, l.created_at AS createdAt,
      (SELECT COUNT(*) FROM join_applications a WHERE a.join_link_id = l.id) AS applicationCount,
      (SELECT COUNT(*) FROM join_applications a WHERE a.join_link_id = l.id AND a.status = 'pending') AS pendingCount
    FROM join_links l
    ORDER BY l.created_at DESC
    LIMIT 100
  `).all();

  return c.json({ success: true, data: result.results || [] });
});

adminJoinRoutes.post('/links/:id/revoke', async (c) => {
  if (!requireSuperAdmin(c)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the Super Admin can revoke join links.' } }, 403);
  }

  const id = c.req.param('id');
  const result = await c.env.DB.prepare(`
    UPDATE join_links
    SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND revoked_at IS NULL
  `).bind(id).run();

  if (!result.meta.changes) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Active join link not found.' } }, 404);
  }

  await appendAuditLog(c, {
    action: 'JOIN_LINK_REVOKED',
    entityType: 'join_links',
    entityId: id
  });

  return c.json({ success: true, data: { id, revoked: true } });
});

adminJoinRoutes.get('/applications', async (c) => {
  if (!requireSuperAdmin(c)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the Super Admin can review applications.' } }, 403);
  }

  const status = c.req.query('status') || 'pending';
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid status filter.' } }, 400);
  }

  const result = status === 'all'
    ? await c.env.DB.prepare(`
        SELECT a.id, a.full_name AS fullName, a.email, a.phone, a.message,
          a.status, a.submitted_at AS submittedAt, a.reviewed_at AS reviewedAt,
          a.rejection_reason AS rejectionReason, l.label AS linkLabel
        FROM join_applications a
        JOIN join_links l ON l.id = a.join_link_id
        ORDER BY a.submitted_at DESC LIMIT 200
      `).all()
    : await c.env.DB.prepare(`
        SELECT a.id, a.full_name AS fullName, a.email, a.phone, a.message,
          a.status, a.submitted_at AS submittedAt, a.reviewed_at AS reviewedAt,
          a.rejection_reason AS rejectionReason, l.label AS linkLabel
        FROM join_applications a
        JOIN join_links l ON l.id = a.join_link_id
        WHERE a.status = ?
        ORDER BY a.submitted_at DESC LIMIT 200
      `).bind(status).all();

  return c.json({ success: true, data: result.results || [] });
});

adminJoinRoutes.post('/applications/:id/approve', async (c) => {
  const actor = c.get('authUser');
  if (actor.roleCode !== 'super_admin') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the Super Admin can approve applicants.' } }, 403);
  }

  const parsed = approveSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Choose a valid ERP role.' } }, 400);
  }

  const applicationId = c.req.param('id');
  const application = await c.env.DB.prepare(`
    SELECT id, full_name, email, phone, status
    FROM join_applications WHERE id = ?
  `).bind(applicationId).first<{
    id: string; full_name: string; email: string; phone: string | null; status: string;
  }>();

  if (!application || application.status !== 'pending') {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Pending application not found.' } }, 404);
  }

  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(application.email).first();

  if (existingUser) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'An ERP account already exists for this email. Review it in User Management instead.' } }, 409);
  }

  const role = await c.env.DB.prepare(
    'SELECT id, code FROM roles WHERE code = ?'
  ).bind(parsed.data.roleCode).first<{ id: string; code: string }>();

  if (!role) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Selected role is unavailable.' } }, 400);
  }

  const userId = crypto.randomUUID();
  const volunteerId = parsed.data.roleCode === 'volunteer' ? crypto.randomUUID() : null;

  try {
    const statements = [
      c.env.DB.prepare(`
        UPDATE join_applications
        SET status = 'approved', reviewed_by = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            created_user_id = ?
        WHERE id = ? AND status = 'pending'
          AND NOT EXISTS (SELECT 1 FROM users WHERE email = ?)
      `).bind(actor.id, userId, applicationId, application.email),
      c.env.DB.prepare(`
        INSERT INTO users (id, email, full_name, phone, role_id, status)
        SELECT ?, ?, ?, ?, ?, 'active'
        WHERE EXISTS (
          SELECT 1 FROM join_applications
          WHERE id = ? AND status = 'approved' AND created_user_id = ?
        )
      `).bind(userId, application.email, application.full_name, application.phone, role.id, applicationId, userId)
    ];
    if (volunteerId) {
      statements.push(c.env.DB.prepare(`
        INSERT INTO volunteers (id, volunteer_code, user_id, full_name, email, phone, skills_json, joined_date, status)
        SELECT ?, 'VOL-' || strftime('%Y%m%d','now') || '-' || substr(hex(randomblob(4)),1,8),
          ?, ?, ?, ?, '[]', date('now'), 'active'
        WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND role_id = ?)
      `).bind(volunteerId, userId, application.full_name, application.email, application.phone || '', userId, role.id));
    }
    const results = await c.env.DB.batch(statements);
    if (!results[0]?.meta.changes || !results[1]?.meta.changes || (volunteerId && !results[2]?.meta.changes)) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: 'The application has already been reviewed or could not be approved.' } }, 409);
    }
  } catch {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'The application may already have been reviewed or the email may already exist.' } }, 409);
  }

  await appendAuditLog(c, {
    action: 'JOIN_APPLICATION_APPROVED',
    entityType: 'join_applications',
    entityId: applicationId,
    after: { userId, volunteerId, email: application.email, roleCode: role.code }
  });

  return c.json({ success: true, data: { applicationId, userId, volunteerId, email: application.email, roleCode: role.code, status: 'active' } });
});

adminJoinRoutes.post('/applications/:id/reject', async (c) => {
  const actor = c.get('authUser');
  if (actor.roleCode !== 'super_admin') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the Super Admin can reject applicants.' } }, 403);
  }

  const parsed = rejectSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid rejection note.' } }, 400);
  }

  const id = c.req.param('id');
  const result = await c.env.DB.prepare(`
    UPDATE join_applications
    SET status = 'rejected', reviewed_by = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        rejection_reason = ?
    WHERE id = ? AND status = 'pending'
  `).bind(actor.id, parsed.data.reason || null, id).run();

  if (!result.meta.changes) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Pending application not found.' } }, 404);
  }

  await appendAuditLog(c, {
    action: 'JOIN_APPLICATION_REJECTED',
    entityType: 'join_applications',
    entityId: id,
    after: { reason: parsed.data.reason || null }
  });

  return c.json({ success: true, data: { applicationId: id, status: 'rejected' } });
});
