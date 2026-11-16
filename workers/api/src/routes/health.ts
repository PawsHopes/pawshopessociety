import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types/env';

export const healthRoutes = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

healthRoutes.get('/', async (c) => {
  let dbStatus = 'ok';
  let migrationsApplied = 0;
  let tableCount = 0;
  try {
    await c.env.DB.prepare('SELECT 1 as ok').first();
    const migrationRow = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM d1_migrations').first<{ count: number }>();
    const tableRow = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").first<{ count: number }>();
    migrationsApplied = Number(migrationRow?.count || 0);
    tableCount = Number(tableRow?.count || 0);
  } catch {
    dbStatus = 'error';
  }

  const schemaReady = dbStatus === 'ok' && migrationsApplied >= 16 && tableCount >= 40;
  c.header('Cache-Control', 'no-store');
  return c.json(
    {
      success: schemaReady,
      data: {
        service: 'pawshopes-erp-api',
        environment: c.env.ENVIRONMENT,
        database: dbStatus,
        schema: { ready: schemaReady, migrationsApplied, tableCount },
        storage: { publicMedia: Boolean(c.env.PUBLIC_MEDIA), privateVault: Boolean(c.env.PRIVATE_VAULT) },
        timestamp: new Date().toISOString(),
      },
    },
    schemaReady ? 200 : 503
  );
});
