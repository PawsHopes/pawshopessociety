import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from '../src/middleware/rateLimit';
import type { Bindings, AppVariables } from '../src/types/env';

function makeApp() {
  const values = new Map<string, string>();
  const kv = {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => { values.set(key, value); },
  } as unknown as KVNamespace;
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', rateLimit({ bucket: 'test', maxRequests: 1, windowSeconds: 60 }));
  app.get('/', (c) => c.text('ok'));
  return { app, kv, values };
}

describe('rate limiting', () => {
  it('limits repeated requests and stores a hashed client address', async () => {
    const { app, kv, values } = makeApp();
    const env = { ENVIRONMENT: 'production', RATE_LIMIT_KV: kv } as unknown as Bindings;
    const first = await app.request('/', { headers: { 'CF-Connecting-IP': '203.0.113.10' } }, env);
    const second = await app.request('/', { headers: { 'CF-Connecting-IP': '203.0.113.10' } }, env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
    expect([...values.keys()].every((key) => !key.includes('203.0.113.10'))).toBe(true);
  });

  it('fails closed in production when the rate-limit KV binding is missing', async () => {
    const { app } = makeApp();
    const env = { ENVIRONMENT: 'production' } as unknown as Bindings;
    const response = await app.request('/', {}, env);
    expect(response.status).toBe(503);
  });

  it('does not block local development when KV is not configured', async () => {
    const { app } = makeApp();
    const env = { ENVIRONMENT: 'development' } as unknown as Bindings;
    const response = await app.request('/', {}, env);
    expect(response.status).toBe(200);
  });
});
