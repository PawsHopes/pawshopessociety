import { describe, expect, it } from 'vitest';
import { verifyCloudflareAccessJwt } from '../src/middleware/cfAccessAuth';

function encode(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}


function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
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


  it('accepts a correctly signed Cloudflare Access JWT with the expected issuer and audience', async () => {
    const domain = 'jwt-valid-test.cloudflareaccess.com';
    const now = Math.floor(Date.now() / 1000);
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    const exported = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const jwk = { ...exported, kid: 'valid-test-key', alg: 'RS256', use: 'sig' };
    const header = encode({ alg: 'RS256', kid: 'valid-test-key' });
    const payload = encode({
      iss: `https://${domain}`,
      aud: ['aud'],
      exp: now + 300,
      nbf: now - 5,
      iat: now,
      email: 'User@Example.org',
    });
    const signingInput = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keyPair.privateKey,
      new TextEncoder().encode(signingInput)
    );
    const token = `${signingInput}.${encodeBytes(new Uint8Array(signature))}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    try {
      await expect(verifyCloudflareAccessJwt(token, domain, 'aud')).resolves.toEqual({
        email: 'user@example.org',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('accepts any configured Access audience for the current hostname', async () => {
    const domain = 'jwt-multi-aud-test.cloudflareaccess.com';
    const now = Math.floor(Date.now() / 1000);
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    const exported = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const jwk = { ...exported, kid: 'multi-aud-test-key', alg: 'RS256', use: 'sig' };
    const header = encode({ alg: 'RS256', kid: 'multi-aud-test-key' });
    const payload = encode({
      iss: `https://${domain}`,
      aud: ['preview-audience'],
      exp: now + 300,
      nbf: now - 5,
      iat: now,
      email: 'User@Example.org',
    });
    const signingInput = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keyPair.privateKey,
      new TextEncoder().encode(signingInput)
    );
    const token = `${signingInput}.${encodeBytes(new Uint8Array(signature))}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    try {
      await expect(verifyCloudflareAccessJwt(token, domain, ['live-audience', 'preview-audience'])).resolves.toEqual({
        email: 'user@example.org',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
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
