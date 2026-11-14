import { createMiddleware } from 'hono/factory';
import type { Bindings, AppVariables } from '../types/env';

interface JwkKey extends JsonWebKey {
  kid: string;
  alg?: string;
}

let cachedKeys: { fetchedAt: number; keys: JwkKey[] } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

function base64UrlToUint8Array(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

async function getCloudflarePublicKeys(teamDomain: string): Promise<JwkKey[]> {
  const now = Date.now();
  if (cachedKeys && now - cachedKeys.fetchedAt < JWKS_TTL_MS) {
    return cachedKeys.keys;
  }
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Cloudflare Access JWKS (${res.status})`);
  }
  const data = (await res.json()) as { keys?: JwkKey[] };
  if (!data.keys || !Array.isArray(data.keys)) {
    throw new Error('Invalid JWKS payload from Cloudflare Access');
  }
  cachedKeys = { fetchedAt: now, keys: data.keys };
  return data.keys;
}

export async function verifyCloudflareAccessJwt(
  token: string,
  teamDomain: string,
  expectedAud: string
): Promise<{ email: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT structure');
  }
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const header = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(headerB64))) as {
    kid?: string;
    alg?: string;
  };
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(payloadB64))) as {
    email?: string;
    aud?: string | string[];
    iss?: string;
    exp?: number;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported JWT algorithm or missing kid');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Cloudflare Access token expired');
  }

  const expectedIss = `https://${teamDomain}`;
  if (payload.iss !== expectedIss) {
    throw new Error('Invalid token issuer');
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!audiences.includes(expectedAud)) {
    throw new Error('Invalid token audience');
  }

  if (!payload.email) {
    throw new Error('Token missing email claim');
  }

  const keys = await getCloudflarePublicKeys(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error('Signing key not found in Cloudflare JWKS');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedContent = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToUint8Array(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedContent);
  if (!valid) {
    throw new Error('JWT cryptographic signature verification failed');
  }

  return { email: payload.email.toLowerCase().trim() };
}

export const cfAccessAuth = createMiddleware<{
  Bindings: Bindings;
  Variables: AppVariables;
}>(async (c, next) => {
  // Local development escape hatch (strictly disabled in staging & production)
  if (c.env.ENVIRONMENT === 'development') {
    const devEmail = c.req.header('X-Dev-User-Email');
    if (devEmail && devEmail.includes('@')) {
      c.set('authEmail', devEmail.toLowerCase().trim());
      return next();
    }
  }

  const jwt =
    c.req.header('Cf-Access-Jwt-Assertion') ||
    c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');

  if (!jwt) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Cloudflare Access authentication token.',
        },
      },
      401
    );
  }

  try {
    const { email } = await verifyCloudflareAccessJwt(
      jwt,
      c.env.CF_ACCESS_TEAM_DOMAIN,
      c.env.CF_ACCESS_AUD
    );
    c.set('authEmail', email);
    return next();
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: err instanceof Error ? err.message : 'Invalid authentication token.',
        },
      },
      401
    );
  }
});
