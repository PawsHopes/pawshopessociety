import { describe, expect, it } from 'vitest';
import type { Bindings } from '../src/types/env';
import worker from '../src/index';

async function preflight(origin: string, environment: 'staging' | 'production') {
  const adminOrigin = environment === 'staging' ? 'https://phs-phs.pages.dev' : 'https://pha-phs.pages.dev';
  const env = {
    ENVIRONMENT: environment,
    PUBLIC_SITE_ORIGIN: 'https://pawshopessociety.pages.dev',
    ADMIN_ERP_ORIGIN: adminOrigin,
  } as Bindings;
  return worker.fetch(
    new Request('https://erp-api.example.test/api/v1/admin/me', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Cf-Access-Jwt-Assertion',
      },
    }),
    env,
    {} as ExecutionContext,
  );
}

describe('environment-specific ERP CORS origins', () => {
  it('allows staging base and preview Pages hostnames', async () => {
    const base = await preflight('https://phs-phs.pages.dev', 'staging');
    const preview = await preflight('https://123abc.phs-phs.pages.dev', 'staging');
    expect(base.headers.get('Access-Control-Allow-Origin')).toBe('https://phs-phs.pages.dev');
    expect(preview.headers.get('Access-Control-Allow-Origin')).toBe('https://123abc.phs-phs.pages.dev');
  });

  it('allows production base and preview Pages hostnames', async () => {
    const base = await preflight('https://pha-phs.pages.dev', 'production');
    const preview = await preflight('https://123abc.pha-phs.pages.dev', 'production');
    expect(base.headers.get('Access-Control-Allow-Origin')).toBe('https://pha-phs.pages.dev');
    expect(preview.headers.get('Access-Control-Allow-Origin')).toBe('https://123abc.pha-phs.pages.dev');
  });

  it('does not allow a preview hostname from the other environment', async () => {
    const staging = await preflight('https://123abc.pha-phs.pages.dev', 'staging');
    const production = await preflight('https://123abc.phs-phs.pages.dev', 'production');
    expect(staging.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(production.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects lookalike domains and insecure preview origins', async () => {
    const lookalike = await preflight('https://phs-phs.pages.dev.attacker.example', 'staging');
    const insecure = await preflight('http://123abc.phs-phs.pages.dev', 'staging');
    expect(lookalike.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(insecure.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
