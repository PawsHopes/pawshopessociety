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

  return c.json({
    success: true,
    data: {
      service: 'pawshopes-erp-api',
      organization: "Paw's Hopez Society",
      environment: c.env.ENVIRONMENT,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
  });
});
