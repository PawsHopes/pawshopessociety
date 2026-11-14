import { describe, expect, it } from 'vitest';
import { verifyCloudflareAccessJwt } from '../src/middleware/cfAccessAuth';

function encode(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_');
}

describe('Cloudflare Access JWT validation', () => {
  it('rejects oversized tokens before attempting key retrieval', async () => {
    await expect(
      verifyCloudflareAccessJwt('a'.repeat(8193), 'example.cloudflareaccess.com', 'aud')
    ).rejects.toThrow(/maximum permitted size/);
  });

  it('rejects unsupported signing algorithms', async () => {
    const token = `${encode({ alg: 'none', kid: 'test' })}.${encode({})}.signature`;
    await expect(
      verifyCloudflareAccessJwt(token, 'example.cloudflareaccess.com', 'aud')
    ).rejects.toThrow(/Unsupported JWT algorithm/);
  });

  it('rejects invalid issuer before retrieving signing keys', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({
      iss: 'https://attacker.example',
      aud: 'aud',
      exp: now + 300,
      email: 'user@example.org'
    })}.signature`;
    await expect(
      verifyCloudflareAccessJwt(token, 'example.cloudflareaccess.com', 'aud')
    ).rejects.toThrow(/issuer/);
  });

  it('rejects tokens that are not yet valid', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({
      iss: 'https://example.cloudflareaccess.com',
      aud: 'aud',
      exp: now + 300,
      nbf: now + 120,
      email: 'user@example.org'
    })}.signature`;
    await expect(
      verifyCloudflareAccessJwt(token, 'example.cloudflareaccess.com', 'aud')
    ).rejects.toThrow(/not yet valid/);
  });

  it('rejects a mismatched audience before retrieving signing keys', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = `${encode({ alg: 'RS256', kid: 'test' })}.${encode({
      iss: 'https://example.cloudflareaccess.com',
      aud: 'different-audience',
      exp: now + 300,
      email: 'user@example.org'
    })}.signature`;
    await expect(
      verifyCloudflareAccessJwt(token, 'example.cloudflareaccess.com', 'aud')
    ).rejects.toThrow(/audience/);
  });
});
