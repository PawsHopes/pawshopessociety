import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppVariables, AuthUser, Bindings } from '../src/types/env';
import { adminDocumentRoutes, publicFileProxyRoutes } from '../src/routes/admin/documents';
import { createSignedDocumentToken, verifySignedDocumentToken } from '../src/services/r2Storage';

const secret = 'document-route-test-signing-secret-at-least-32-bytes';

const admin: AuthUser = {
  id: 'user_456',
  email: 'hopezpaws@gmail.com',
  fullName: 'Society Admin',
  roleCode: 'super_admin',
  roleName: 'Super Admin',
  permissions: ['documents:private_read', 'compliance:read', 'compliance:write'],
};

const userRow = {
  id: admin.id,
  email: admin.email,
  full_name: admin.fullName,
  status: 'active',
  role_code: 'super_admin' as const,
  role_name: 'Super Admin',
  role_id: 'role_super_admin',
};

function makeDb(documentRow: Record<string, unknown> | null = null, permissions = admin.permissions) {
  const statements: string[] = [];
  const db = {
    statements,
    prepare(sql: string) {
      statements.push(sql);
      return {
        bind(..._values: unknown[]) {
          return {
            run: async () => ({ success: true }),
            first: async () => {
              if (sql.includes('FROM documents')) return documentRow;
              if (sql.includes('FROM users')) return userRow;
              return null;
            },
            all: async () => ({ results: permissions.map((code) => ({ code })) }),
          };
        },
      };
    },
  };
  return db;
}

function adminApp() {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('authUser', admin);
    await next();
  });
  app.route('/api/v1/admin', adminDocumentRoutes);
  return app;
}

function downloadApp() {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.route('/api/v1/files', publicFileProxyRoutes);
  return app;
}

function makeEnv(db: ReturnType<typeof makeDb>, privateVault: Record<string, unknown>) {
  return {
    DB: db,
    PRIVATE_VAULT: privateVault,
    PUBLIC_MEDIA_BASE_URL: 'https://media.example.test',
    SIGNED_URL_SECRET: secret,
    ENVIRONMENT: 'development',
    PUBLIC_SITE_ORIGIN: 'https://pawshopessociety.pages.dev',
    ADMIN_ERP_ORIGIN: 'https://phs-phs.pages.dev',
    CF_ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com',
    CF_ACCESS_AUD: 'test-aud',
  } as unknown as Bindings;
}

function pdfFile(name = 'medical-report.pdf') {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0x45, 0x4f])], name, {
    type: 'application/pdf',
  });
}

describe('private document upload and download routes', () => {
  it('stores a validated private PDF in the private R2 bucket and records metadata', async () => {
    const put = vi.fn(async (..._args: unknown[]) => undefined);
    const db = makeDb();
    const app = adminApp();
    const form = new FormData();
    form.set('file', pdfFile('../../medical-report.pdf'));
    form.set('docCategory', 'compliance_cert');
    form.set('title', 'Medical report');

    const response = await app.request(
      '/api/v1/admin/uploads/private-doc',
      { method: 'POST', body: form },
      makeEnv(db, { put }) ,
    );

    expect(response.status).toBe(201);
    expect(put).toHaveBeenCalledTimes(1);
    expect(String(put.mock.calls[0]?.[0])).toMatch(/^vault\/compliance_cert\/\d{4}\//);
    expect(db.statements.some((sql) => sql.includes('INSERT INTO documents'))).toBe(true);
    const payload = await response.json() as { success: boolean; data: { mime: string; category: string } };
    expect(payload.success).toBe(true);
    expect(payload.data.mime).toBe('application/pdf');
  });

  it('rejects a file whose actual bytes do not match an allowed document type', async () => {
    const put = vi.fn(async () => undefined);
    const db = makeDb();
    const app = adminApp();
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], 'fake.pdf', {
      type: 'application/pdf',
    }));
    form.set('docCategory', 'compliance_cert');
    form.set('title', 'Fake report');

    const response = await app.request(
      '/api/v1/admin/uploads/private-doc',
      { method: 'POST', body: form },
      makeEnv(db, { put }),
    );

    expect(response.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects private uploads when the user lacks category-specific write permission', async () => {
    const put = vi.fn(async () => undefined);
    const db = makeDb(null, ['documents:private_read', 'medical:read']);
    const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
    app.use('*', async (c, next) => {
      c.set('authUser', { ...admin, permissions: ['medical:read'] });
      await next();
    });
    app.route('/api/v1/admin', adminDocumentRoutes);
    const form = new FormData();
    form.set('file', pdfFile());
    form.set('docCategory', 'compliance_cert');
    form.set('title', 'Restricted report');

    const response = await app.request(
      '/api/v1/admin/uploads/private-doc',
      { method: 'POST', body: form },
      makeEnv(db, { put }),
    );

    expect(response.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it('issues a short-lived signed URL bound to the document and requesting admin', async () => {
    const db = makeDb({ id: 'doc_123', title: 'Medical report', doc_category: 'compliance_cert' });
    const app = adminApp();
    const response = await app.request(
      '/api/v1/admin/documents/doc_123/signed-url',
      { method: 'GET' },
      makeEnv(db, {}),
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { success: boolean; data: { url: string; expiresAt: string } };
    expect(payload.success).toBe(true);
    const token = payload.data.url.split('/api/v1/files/private/')[1];
    expect(token).toBeTruthy();
    await expect(verifySignedDocumentToken(token, secret)).resolves.toEqual({
      documentId: 'doc_123',
      userId: admin.id,
    });
    expect(Date.parse(payload.data.expiresAt)).toBeGreaterThan(Date.now());
    expect(Date.parse(payload.data.expiresAt)).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 1000);
  });

  it('serves the private R2 object only to the same authenticated user who received the link', async () => {
    const { token } = await createSignedDocumentToken('doc_123', admin.id, secret, 60);
    const body = new Response('private PDF bytes').body;
    const get = vi.fn(async () => ({ body }));
    const db = makeDb({
      r2_private_key: 'vault/compliance_cert/2026/doc_123.pdf',
      file_name: 'medical-report.pdf',
      mime_type: 'application/pdf',
      doc_category: 'compliance_cert',
    });
    const app = downloadApp();

    const response = await app.request(
      `/api/v1/files/private/${token}`,
      { method: 'GET', headers: { 'X-Dev-User-Email': admin.email } },
      makeEnv(db, { get }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('private PDF bytes');
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Cache-Control')).toBe('no-store, private');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(get).toHaveBeenCalledWith('vault/compliance_cert/2026/doc_123.pdf');
  });

  it('blocks a different user from reusing another admin\'s signed URL', async () => {
    const { token } = await createSignedDocumentToken('doc_123', 'another-user', secret, 60);
    const get = vi.fn(async () => ({ body: new Response('private PDF bytes').body }));
    const db = makeDb({
      r2_private_key: 'vault/compliance_cert/2026/doc_123.pdf',
      file_name: 'medical-report.pdf',
      mime_type: 'application/pdf',
      doc_category: 'compliance_cert',
    });
    const app = downloadApp();

    const response = await app.request(
      `/api/v1/files/private/${token}`,
      { method: 'GET', headers: { 'X-Dev-User-Email': admin.email } },
      makeEnv(db, { get }),
    );

    expect(response.status).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });
});
