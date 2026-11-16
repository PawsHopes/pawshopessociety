import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createSignedDocumentToken } from '../src/services/r2Storage';
import type { Bindings, AppVariables } from '../src/types/env';

vi.mock('../src/middleware/cfAccessAuth', () => ({
  cfAccessAuth: async (c: any, next: () => Promise<void>) => {
    if (!c.req.header('x-test-user')) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
    }
    await next();
  },
}));

vi.mock('../src/middleware/rbac', () => ({
  requirePermission: () => async (_c: any, next: () => Promise<void>) => next(),
  loadRbacUser: async (c: any, next: () => Promise<void>) => {
    const id = c.req.header('x-test-user') || '';
    const permissions = (c.req.header('x-test-permissions') || '').split(',').filter(Boolean);
    c.set('authUser', {
      id,
      email: id + '@example.test',
      fullName: 'Test User',
      roleCode: 'vet_staff',
      roleName: 'Vet Staff',
      permissions,
    });
    await next();
  },
}));

import { publicFileProxyRoutes } from '../src/routes/admin/documents';

const secret = 'private-document-route-test-secret-with-at-least-32-bytes';
const document = {
  r2_private_key: 'vault/vet_bill/2026/private.pdf',
  file_name: 'medical-record.pdf',
  mime_type: 'application/pdf',
  doc_category: 'vet_bill',
};

function makeApp() {
  let reads = 0;
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.route('/files', publicFileProxyRoutes);
  const env = {
    SIGNED_URL_SECRET: secret,
    PRIVATE_VAULT: {
      get: async () => {
        reads += 1;
        return { body: new Response('private file bytes').body };
      },
    },
    DB: {
      prepare: () => ({ first: async () => document }),
    },
  } as unknown as Bindings;
  return { app, env, getReads: () => reads };
}

const allowed = 'documents:private_read,medical:read';

describe('private document download route security', () => {
  it('requires a fresh authenticated identity before serving a signed link', async () => {
    const { app, env, getReads } = makeApp();
    const { token } = await createSignedDocumentToken('doc_123', 'user_123', secret, 60);
    const response = await app.request('/files/private/' + token, {}, env);
    expect(response.status).toBe(401);
    expect(getReads()).toBe(0);
  });

  it('rejects a valid token when another account attempts to use it', async () => {
    const { app, env, getReads } = makeApp();
    const { token } = await createSignedDocumentToken('doc_123', 'user_123', secret, 60);
    const response = await app.request('/files/private/' + token, {
      headers: { 'x-test-user': 'user_456', 'x-test-permissions': allowed },
    }, env);
    expect(response.status).toBe(403);
    expect(getReads()).toBe(0);
  });

  it('rechecks current category permissions after token issuance', async () => {
    const { app, env, getReads } = makeApp();
    const { token } = await createSignedDocumentToken('doc_123', 'user_123', secret, 60);
    const response = await app.request('/files/private/' + token, {
      headers: { 'x-test-user': 'user_123', 'x-test-permissions': 'documents:private_read' },
    }, env);
    expect(response.status).toBe(403);
    expect(getReads()).toBe(0);
  });

  it('serves the R2 object only after identity, token ownership and current permissions pass', async () => {
    const { app, env, getReads } = makeApp();
    const { token } = await createSignedDocumentToken('doc_123', 'user_123', secret, 60);
    const response = await app.request('/files/private/' + token, {
      headers: { 'x-test-user': 'user_123', 'x-test-permissions': allowed },
    }, env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('private file bytes');
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(getReads()).toBe(1);
  });
});
