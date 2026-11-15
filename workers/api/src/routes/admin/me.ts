import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../../types/env';

export const adminMeRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

adminMeRoutes.get('/', async (c) => {
  const user = c.get('authUser');
  await c.env.DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`)
    .bind(user.id)
    .run();

  return c.json({
    success: true,
    data: user,
  });
});
