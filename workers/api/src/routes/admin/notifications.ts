import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';

export const adminNotificationsRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

adminNotificationsRoutes.get('/', async (c) => {
  const actor = c.get('authUser');
  const limit = Math.min(Math.max(Number(c.req.query('limit') || 30) || 30, 1), 100);
  const [items, unread] = await Promise.all([
    c.env.DB.prepare(`SELECT id, type, title, message, link, is_read AS isRead, created_at AS createdAt
      FROM notifications
      WHERE user_id = ? OR target_role_code = ?
      ORDER BY created_at DESC LIMIT ?`).bind(actor.id, actor.roleCode, limit).all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE is_read = 0 AND (user_id = ? OR target_role_code = ?)`).bind(actor.id, actor.roleCode).first<{count:number}>(),
  ]);
  return c.json({ success: true, data: { items: items.results || [], unreadCount: Number(unread?.count || 0) } });
});

adminNotificationsRoutes.post('/read-all', async (c) => {
  const actor = c.get('authUser');
  await c.env.DB.prepare(`UPDATE notifications SET is_read = 1
    WHERE is_read = 0 AND (user_id = ? OR target_role_code = ?)`).bind(actor.id, actor.roleCode).run();
  return c.json({ success: true, data: { markedRead: true } });
});

adminNotificationsRoutes.post('/:id/read', async (c) => {
  const actor = c.get('authUser');
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(`UPDATE notifications SET is_read = 1
    WHERE id = ? AND (user_id = ? OR target_role_code = ?)`).bind(id, actor.id, actor.roleCode).run();
  if ((result.meta?.changes ?? 0) !== 1) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found.' } }, 404);
  return c.json({ success: true, data: { id, isRead: true } });
});
