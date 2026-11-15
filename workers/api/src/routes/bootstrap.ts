import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';

export const bootstrapRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// One-time, staging-only bootstrap. Cloudflare Access authenticates the caller;
// this endpoint can only create the single email explicitly allowlisted in Worker vars.
bootstrapRoutes.post('/super-admin', async (c) => {
  if (c.env.ENVIRONMENT !== 'staging') {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Bootstrap is disabled outside staging.' } }, 404);
  }

  const allowedEmail = c.env.STAGING_BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
  const authenticatedEmail = c.get('authEmail')?.toLowerCase().trim();
  if (!allowedEmail || !authenticatedEmail || authenticatedEmail !== allowedEmail) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'This Access identity is not allowed to initialize the staging Super Admin.' } }, 403);
  }

  const existingAdmin = await c.env.DB.prepare(
    "SELECT id FROM users WHERE role_id = 'role_super_admin' AND status = 'active' LIMIT 1"
  ).first<{ id: string }>();
  if (existingAdmin) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'A staging Super Admin has already been initialized.' } }, 409);
  }

  const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
    .bind(authenticatedEmail)
    .first<{ id: string }>();
  if (existingUser) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'This email already has an ERP account. Ask an existing Super Admin to review its role.' } }, 409);
  }

  const id = crypto.randomUUID();
  const ip = c.req.header('CF-Connecting-IP') || null;
  const userAgent = c.req.header('User-Agent') || null;
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO users (id, email, full_name, role_id, status) VALUES (?, ?, 'Paw''s Hopez Society Super Admin', 'role_super_admin', 'active')"
    ).bind(id, authenticatedEmail),
    c.env.DB.prepare(
      "INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, ip_address, user_agent) VALUES (?, ?, ?, 'STAGING_SUPER_ADMIN_BOOTSTRAPPED', 'users', ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), id, authenticatedEmail, id, JSON.stringify({ role: 'super_admin', status: 'active' }), ip, userAgent),
  ]);

  return c.json({ success: true, data: { created: true, email: authenticatedEmail, role: 'super_admin' } }, 201);
});
