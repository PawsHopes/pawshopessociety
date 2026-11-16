import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types/env';

export const bootstrapRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// Identity-verified bootstrap for the two designated Society admins.
// Cloudflare Access JWT verification happens in cfAccessAuth before this route.
const DESIGNATED_SUPER_ADMINS = new Set([
  'hopezpaws@gmail.com',
  'infosecayush@gmail.com',
]);

bootstrapRoutes.post('/super-admin', async (c) => {
  if (c.env.ENVIRONMENT !== 'staging' && c.env.ENVIRONMENT !== 'production') {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Bootstrap is disabled outside staging.' } }, 404);
  }

  const authenticatedEmail = c.get('authEmail')?.toLowerCase().trim();
  if (!authenticatedEmail || !DESIGNATED_SUPER_ADMINS.has(authenticatedEmail)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only a designated Paw\'s Hopez Society administrator can initialize this account.' } }, 403);
  }

  const existingUser = await c.env.DB.prepare(
    'SELECT id, role_id, status FROM users WHERE email = ? LIMIT 1'
  ).bind(authenticatedEmail).first<{ id: string; role_id: string; status: string }>();

  // Make the operation safely repeatable for an already initialized account.
  if (existingUser) {
    if (existingUser.role_id === 'role_super_admin' && existingUser.status === 'active') {
      return c.json({ success: true, data: { created: false, alreadyInitialized: true, email: authenticatedEmail, role: 'super_admin' } });
    }
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'An ERP account already exists for this email with a different role or status. No changes were made.' } }, 409);
  }

  const id = crypto.randomUUID();
  const ip = c.req.header('CF-Connecting-IP') || null;
  const userAgent = c.req.header('User-Agent') || null;

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO users (id, email, full_name, role_id, status) VALUES (?, ?, 'Paw''s Hopez Society Super Admin', 'role_super_admin', 'active')"
      ).bind(id, authenticatedEmail),
      c.env.DB.prepare(
        "INSERT INTO audit_logs (id, actor_user_id, actor_email, action, entity_type, entity_id, after_json, ip_address, user_agent) VALUES (?, ?, ?, c.env.ENVIRONMENT === 'production' ? 'PRODUCTION_SUPER_ADMIN_BOOTSTRAPPED' : 'STAGING_SUPER_ADMIN_BOOTSTRAPPED', 'users', ?, ?, ?, ?)"
      ).bind(crypto.randomUUID(), id, authenticatedEmail, id, JSON.stringify({ role: 'super_admin', status: 'active' }), ip, userAgent),
    ]);
  } catch {
    // A concurrent/retried request may win the unique-email insert. Never grant
    // another identity or change an existing account as a side effect.
    const saved = await c.env.DB.prepare(
      'SELECT id, role_id, status FROM users WHERE email = ? LIMIT 1'
    ).bind(authenticatedEmail).first<{ id: string; role_id: string; status: string }>();
    if (saved?.role_id === 'role_super_admin' && saved.status === 'active') {
      return c.json({ success: true, data: { created: false, alreadyInitialized: true, email: authenticatedEmail, role: 'super_admin' } });
    }
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'The account could not be initialized. No other account was changed.' } }, 409);
  }

  return c.json({ success: true, data: { created: true, email: authenticatedEmail, role: 'super_admin' } }, 201);
});
