import { describe, expect, it } from 'vitest';
import { createSignedDocumentToken, verifySignedDocumentToken } from '../src/services/r2Storage';

const secret = 'test-only-document-signing-secret-with-at-least-32-bytes';

describe('private document token security', () => {
  it('binds a signed download token to one document and one user', async () => {
    const { token } = await createSignedDocumentToken('doc_123', 'user_456', secret, 60);
    await expect(verifySignedDocumentToken(token, secret)).resolves.toEqual({
      documentId: 'doc_123',
      userId: 'user_456',
    });
    const [documentId, userId] = token.split('.');
    expect(documentId).toBe('doc_123');
    expect(userId).toBe('user_456');
  });

  it('rejects tampered document or user identifiers', async () => {
    const { token } = await createSignedDocumentToken('doc_123', 'user_456', secret, 60);
    const parts = token.split('.');
    const tamperedDocument = ['doc_other', ...parts.slice(1)].join('.');
    const tamperedUser = [parts[0], 'user_other', ...parts.slice(2)].join('.');
    await expect(verifySignedDocumentToken(tamperedDocument, secret)).rejects.toThrow();
    await expect(verifySignedDocumentToken(tamperedUser, secret)).rejects.toThrow();
  });

  it('rejects an altered signature and an incorrectly signed token', async () => {
    const { token } = await createSignedDocumentToken('doc_123', 'user_456', secret, 60);
    const parts = token.split('.');
    parts[3] = '0'.repeat(64);
    await expect(verifySignedDocumentToken(parts.join('.'), secret)).rejects.toThrow();
    await expect(verifySignedDocumentToken(token, 'a-different-signing-secret-with-at-least-32-bytes')).rejects.toThrow();
  });

  it('rejects malformed identifiers and token lifetimes above five minutes', async () => {
    await expect(createSignedDocumentToken('bad.id', 'user_456', secret, 60)).rejects.toThrow();
    await expect(createSignedDocumentToken('doc_123', 'user_456', secret, 301)).rejects.toThrow();
    await expect(verifySignedDocumentToken('not-a-token', secret)).rejects.toThrow();
  });
});
