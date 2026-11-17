import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppVariables, Bindings } from '../src/types/env';
import { cfAccessAuth } from '../src/middleware/cfAccessAuth';
import { loadRbacUser } from '../src/middleware/rbac';

const ADMINS = [
  { id: 'live-admin-hope', email: 'hopezpaws@gmail.com', domain: 'hope-session-test.cloudflareaccess.com' },
  { id: 'live-admin-ayush', email: 'infosecayush@gmail.com', domain: 'ayush-session-test.cloudflareaccess.com' },
] as const;

const permissionCodes = Array.from({ length: 31 }, (_, index) => 'permission:' + index);

function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, '').replaceAll('+', '-').replaceAll('/', '_');
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=/g, '');
}

async function createAccessJwt(email: string, domain: string) {
  const pair = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  }, true, ['sign', 'verify']) as CryptoKeyPair;
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk = { ...exported, kid: 'session-test-key', alg: 'RS256', use: 'sig' };
  const now = Math.floor(Date.now() / 1000);
  const signingInput = [
    encode({ alg: 'RS256', kid: 'session-test-key' }),
    encode({ iss: 'https://' + domain, aud: ['staging-aud'], exp: now + 300, nbf: now - 5, iat: now, email }),
  ].join('.');
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(signingInput));
  return { token: signingInput + '.' + encodeBytes(new Uint8Array(signature)), jwk };
}

function makeApp(email: string, id: string, domain: string) {
  const DB = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            first: async () => {
              if (sql.includes('FROM users u') && sql.includes('JOIN roles r')) {
                if (String(values[0]).toLowerCase() !== email) return null;
                return {
                  id,
                  email,
                  full_name: 'Designated Society Super Admin',
                  status: 'active',
                  role_code: 'super_admin',
                  role_name: 'Super Admin',
                  role_id: 'role_super_admin',
                };
              }
              return null;
            },
            all: async () => sql.includes('FROM role_permissions rp')
              ? { results: permissionCodes.map((code) => ({ code })) }
              : { results: [] },
          };
        },
      };
    },
  };

  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();
  app.use('*', cfAccessAuth);
  app.use('*', loadRbacUser);
  app.get('/api/v1/admin/me', (c) => {
    const user = c.get('authUser');
    return c.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        roleCode: user.roleCode,
        roleName: user.roleName,
        permissionCount: user.permissions.length,
        permissions: user.permissions,
      },
    });
  });
  const env = {
    ENVIRONMENT: 'staging',
    CF_ACCESS_TEAM_DOMAIN: domain,
    CF_ACCESS_AUD: 'staging-aud,preview-aud',
    DB,
  } as unknown as Bindings;
  return { app, env };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('real Cloudflare Access JWT middleware parity for designated admins', () => {
  it.each(ADMINS)('$email completes signed Access JWT authentication and receives full Super Admin RBAC', async (admin) => {
    const { token, jwk } = await createAccessJwt(admin.email, admin.domain);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
    const { app, env } = makeApp(admin.email, admin.id, admin.domain);

    const response = await app.request('/api/v1/admin/me', {
      headers: { 'Cf-Access-Jwt-Assertion': token },
    }, env);

    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data: { id: string; email: string; roleCode: string; permissionCount: number; permissions: string[] } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(admin.id);
    expect(body.data.email).toBe(admin.email);
    expect(body.data.roleCode).toBe('super_admin');
    expect(body.data.permissionCount).toBe(31);
    expect(body.data.permissions).toEqual(permissionCodes);
  });
});
