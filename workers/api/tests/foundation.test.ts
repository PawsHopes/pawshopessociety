import { describe, it, expect } from 'vitest';
import app from '../src/index';
import {
  validateUploadFile,
  createSignedDocumentToken,
  verifySignedDocumentToken,
} from '../src/services/r2Storage';

describe('Phase 3 Foundation — Security & Storage Unit Tests', () => {
  it('rejects unauthenticated requests to /api/v1/admin/me with 401', async () => {
    const env = {
        ENVIRONMENT: 'production',
        PUBLIC_SITE_ORIGIN: 'https://pawshopessociety.pages.dev',
        ADMIN_ERP_ORIGIN: 'https://erp-pawshopes.pages.dev',
        CF_ACCESS_TEAM_DOMAIN: 'pawshopessociety.cloudflareaccess.com',
        CF_ACCESS_AUD: 'test-aud',
        PUBLIC_MEDIA_BASE_URL: 'https://media.pawshopessociety.org',
        SIGNED_URL_SECRET: 'test-secret-1234567890',
        DB: {} as D1Database,
        PUBLIC_MEDIA: {} as R2Bucket,
        PRIVATE_VAULT: {} as R2Bucket,
      };
    const executionCtx = {
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
    } as unknown as ExecutionContext;
    const res = await app.fetch(
      new Request('http://localhost/api/v1/admin/me', { method: 'GET' }),
      env,
      executionCtx
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates file magic bytes and rejects disguised executables', () => {
    // Fake EXE header ("MZ...")
    const exeBuffer = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]).buffer;
    expect(() => validateUploadFile(exeBuffer, ['image/jpeg', 'image/png', 'application/pdf'])).toThrow(
      /Invalid or unsupported file format/
    );

    // Valid PDF header ("%PDF-1.7...")
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3]).buffer;
    const valid = validateUploadFile(pdfBuffer, ['application/pdf']);
    expect(valid.mime).toBe('application/pdf');
    expect(valid.ext).toBe('pdf');
  });


  it('rejects weak document signing secrets and token lifetimes over five minutes', async () => {
    await expect(createSignedDocumentToken('doc-123', 'user-456', 'too-short', 300))
      .rejects.toThrow(/at least 32 bytes/);
    await expect(createSignedDocumentToken('doc-123', 'user-456', 'super-strong-test-secret-key-0123456789', 301))
      .rejects.toThrow(/between 1 and 300 seconds/);
  });

  it('signs and verifies short-lived private document tokens and blocks tampering', async () => {
    const secret = 'super-strong-test-secret-key-0123456789';
    const { token } = await createSignedDocumentToken('doc-123', 'user-456', secret, 300);

    const verified = await verifySignedDocumentToken(token, secret);
    expect(verified.documentId).toBe('doc-123');
    expect(verified.userId).toBe('user-456');

    // Tamper with documentId in token
    const tampered = token.replace('doc-123', 'doc-999');
    await expect(verifySignedDocumentToken(tampered, secret)).rejects.toThrow(
      /Invalid document token signature/
    );
  });
});
