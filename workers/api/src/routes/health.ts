import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types/env';

export const healthRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

healthRoutes.get('/', async (c) => {
  let dbStatus = 'ok';
  try {
    await c.env.DB.prepare('SELECT 1 as ok').first();
  } catch {
    dbStatus = 'error';
  }

  c.header('Cache-Control', 'no-store');
  return c.json(
    {
      success: dbStatus === 'ok',
      data: {
        service: 'pawshopes-erp-api',
        database: dbStatus,
        storage: { publicMedia: Boolean(c.env.PUBLIC_MEDIA), privateVault: Boolean(c.env.PRIVATE_VAULT) },
        timestamp: new Date().toISOString(),
      },
    },
    dbStatus === 'ok' ? 200 : 503
  );
});
