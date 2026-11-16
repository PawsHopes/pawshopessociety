import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types/env';
import { TRUSTED_SUPER_ADMIN_EMAILS } from '../middleware/rbac';

export const bootstrapRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// One-time, staging-only bootstrap. Cloudflare Access authenticates the caller.
// The first approved bootstrap creates both canonical trusted Super Admins together.
bootstrapRoutes.post('/super-admin', async (c) => {
  if (c.env.ENVIRONMENT !== 'staging') {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Bootstrap is disabled outside staging.' } }, 404);
  }

  const allowedEmail = c.env.STAGING_BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
  const authenticatedEmail = c.get('authEmail')?.toLowerCase().trim();
  if (!allowedEmail || !authenticatedEmail || authenticatedEmail !== allowedEmail ||
      !TRUSTED_SUPER_ADMIN_EMAILS.includes(authenticatedEmail as (typeof TRUSTED_SUPER_ADMIN_EMAILS)[number])) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'This Access identity is not allowed to initialize the staging Super Admin accounts.' } }, 403);
  }

  const existingAdmin = await c.env.DB.prepare(
    "SELECT id FROM users WHERE role_id = 'role_super_admin' AND status = 'active' LIMIT 1"
  ).first<{ id: string }>();
  if (existingAdmin) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'A staging Super Admin has already been initialized.' } }, 409);
  }

  const emails = [...TRUSTED_SUPER_ADMIN_EMAILS];
  const placeholders = emails.map(() => '?').join(',');
  const existingUsers = await c.env.DB.prepare(
    `SELECT email FROM users WHERE lower(email) IN (${placeholders})`
  ).bind(...emails).all<{ email: string }>();
  if ((existingUsers.results || []).length > 0) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'One or more trusted administrator accounts already exist. Ask an authorized administrator to review the staging setup.' } }, 409);
  }

  const primaryId = crypto.randomUUID();
  const secondaryId = crypto.randomUUID();
  const primaryEmail = authenticatedEmail;
  const secondaryEmail = emails.find((email) => email !== primaryEmail);
  if (!secondaryEmail) {
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'The trusted administrator list is incomplete.' } }, 500);
  }

  const ip = c.req.header('CF-Connecting-IP') || null;
  const userAgent = c.req.header('User-Agent') || null;
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO users (id, email, full_name, role_id, status) VALUES (?, ?, 'Paw''s Hopez Society Super Admin', 'role_super_admin', 'active')"
    ).bind(primaryId, primaryEmail),
    c.env.DB.prepare(
      "INSERT INTO users (id, email, full_name, role_id, status) VALUES (?, ?, 'Paw''s Hopez Society Super Admin', 'role_super_admin', 'active')"
    ).bind(secondaryId, secondaryEmail),
    c.env.DB.prepare(
      "INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, ip_address, user_agent) VALUES (?, ?, ?, 'STAGING_SUPER_ADMIN_BOOTSTRAPPED', 'users', ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), primaryId, primaryEmail, primaryId, JSON.stringify({ email: primaryEmail, role: 'super_admin', status: 'active' }), ip, userAgent),
    c.env.DB.prepare(
      "INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, ip_address, user_agent) VALUES (?, ?, ?, 'TRUSTED_SUPER_ADMIN_CREATED', 'users', ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), primaryId, primaryEmail, secondaryId, JSON.stringify({ email: secondaryEmail, role: 'super_admin', status: 'active' }), ip, userAgent),
  ]);

  return c.json({
    success: true,
    data: {
      created: true,
      administrators: emails,
      role: 'super_admin',
      equalPermissions: true,
    },
  }, 201);
});
