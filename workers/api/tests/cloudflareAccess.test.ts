import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../src/types/env';
import { revokeEmailFromCloudflareAccess, syncApprovedEmailToCloudflareAccess } from '../src/services/cloudflareAccess';

const stagingPolicies = [
  { appId: 'b63d3bd9-4aea-4618-8221-f13d26f9519e', policyId: '3fe62b03-bb97-47d3-8839-02001fee7ce0' },
  { appId: '1dbcd4ff-450d-497c-abb4-d841f3904675', policyId: '2e71687b-0135-44cc-b3b9-d1c7ae1652f3' },
];
const productionPolicies = [
  { appId: '6c1ef6fc-418f-4f17-a38f-75d90fa2cce1', policyId: '9c1d9354-5887-46dd-bf35-97eb66279da4' },
  { appId: 'd71574dd-f676-4f90-825b-aa3000f9717f', policyId: 'add98604-0c3c-45db-bf35-97eb66279da4' },
];

const env = (token?: string, environment = 'staging') => ({
  ENVIRONMENT: environment,
  CF_ACCESS_API_TOKEN: token,
} as Bindings);

const makePolicy = (policyId: string, include: Array<Record<string, unknown>> = [{ email: { email: 'hopezpaws@gmail.com' } }]) => ({
  id: policyId,
  name: 'Allow approved Paws Hopes Society members',
  decision: 'allow',
  include,
  exclude: [],
  require: [],
  precedence: 1,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockPolicyApi(policies: Array<{ appId: string; policyId: string }>, includeEmail = 'hopezpaws@gmail.com') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const target = policies.find((item) => url.includes(item.appId));
    if (!target) throw new Error('Unexpected Access application: ' + url);
    if (init?.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        result: makePolicy(target.policyId, [{ email: { email: includeEmail } }]),
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('environment-specific Cloudflare Access synchronization', () => {
  it('leaves sync pending when the API token is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncApprovedEmailToCloudflareAccess(env(), 'member@example.com');
    expect(result.status).toBe('pending');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updates only the staging Access applications from the staging Worker', async () => {
    const fetchMock = mockPolicyApi(stagingPolicies);
    const result = await syncApprovedEmailToCloudflareAccess(env('test-token', 'staging'), 'member@example.com');
    expect(result.status).toBe('synced');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.every((call) => !productionPolicies.some((p) => String(call[0]).includes(p.appId)))).toBe(true);
  });

  it('updates only the live Access applications from the production Worker', async () => {
    const fetchMock = mockPolicyApi(productionPolicies);
    const result = await syncApprovedEmailToCloudflareAccess(env('test-token', 'production'), 'member@example.com');
    expect(result.status).toBe('synced');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.every((call) => !stagingPolicies.some((p) => String(call[0]).includes(p.appId)))).toBe(true);
  });

  it('allows the peer administrator to be removed from live Access when suspended', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const target = productionPolicies.find((item) => url.includes(item.appId));
      if (!target) throw new Error('Unexpected live Access application');
      if (init?.method === 'GET') {
        return new Response(JSON.stringify({
          success: true,
          result: makePolicy(target.policyId, [
            { email: { email: 'hopezpaws@gmail.com' } },
            { email: { email: 'infosecayush@gmail.com' } },
          ]),
        }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.include).toEqual([{ email: { email: 'infosecayush@gmail.com' } }]);
      return new Response(JSON.stringify({ success: true, result: body }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await revokeEmailFromCloudflareAccess(env('test-token', 'production'), 'hopezpaws@gmail.com');
    expect(result.status).toBe('synced');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not mutate any Access policy from an unconfigured environment', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncApprovedEmailToCloudflareAccess(env('test-token', 'development'), 'member@example.com');
    expect(result.status).toBe('pending');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
