import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';
import { requirePermission } from '../../middleware/rbac';

export const adminAuditLogRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

adminAuditLogRoutes.get('/', requirePermission('audit:read'), async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);
  const entityType = c.req.query('entityType');

  let query = `
    SELECT id, actor_user_id as actorUserId, actor_email as actorEmail,
           action, entity_type as entityType, entity_id as entityId,
           before_json as beforeJson, after_json as afterJson,
           ip_address as ipAddress, created_at as createdAt
    FROM audit_logs
  `;
  const params: unknown[] = [];
  if (entityType) {
    query += ' WHERE entity_type = ?';
    params.push(entityType);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = c.env.DB.prepare(query).bind(...params);
  const res = await stmt.all();

  return c.json({
    success: true,
    data: res.results || [],
  });
});
