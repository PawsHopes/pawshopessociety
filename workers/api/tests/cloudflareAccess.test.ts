import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../src/types/env';
import { syncApprovedEmailToCloudflareAccess } from '../src/services/cloudflareAccess';

const env = (token?: string) => ({ CF_ACCESS_API_TOKEN: token } as Bindings);

const policies = [
  { appId: 'b63d3bd9-4aea-4618-8221-f13d26f9519e', policyId: '3fe62b03-bb97-47d3-8839-02001fee7ce0' },
];

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

describe('syncApprovedEmailToCloudflareAccess', () => {
  it('leaves sync pending when the API token is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncApprovedEmailToCloudflareAccess(env(), 'member@example.com');
    expect(result.status).toBe('pending');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds only the exact approved email to the protected ERP policy', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const target = policies.find((item) => url.includes(item.appId));
      if (!target) throw new Error('Unexpected Access application');
      if (init?.method === 'GET') {
        return new Response(JSON.stringify({ success: true, result: makePolicy(target.policyId) }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.include).toEqual([
        { email: { email: 'hopezpaws@gmail.com' } },
        { email: { email: 'member@example.com' } },
      ]);
      expect(body.decision).toBe('allow');
      expect(body.exclude).toEqual([]);
      expect(body.require).toEqual([]);
      expect(body.precedence).toBe(1);
      return new Response(JSON.stringify({ success: true, result: body }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncApprovedEmailToCloudflareAccess(env('test-token'), ' Member@Example.com ');
    expect(result.status).toBe('synced');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'PUT')).toHaveLength(0);
  });

  it('does not modify a policy containing a broad Everyone rule', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: makePolicy(policies[0]!.policyId, [{ everyone: {} }]),
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncApprovedEmailToCloudflareAccess(env('test-token'), 'member@example.com');
    expect(result.status).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate an email already present in the ERP policy', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const target = policies.find((item) => url.includes(item.appId));
      if (!target) throw new Error('Unexpected Access application');
      const include = [{ email: { email: 'hopezpaws@gmail.com' } }, { email: { email: 'member@example.com' } }];
      if (init?.method === 'GET') {
        return new Response(JSON.stringify({ success: true, result: makePolicy(target.policyId, include) }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, result: makePolicy(target.policyId, include) }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncApprovedEmailToCloudflareAccess(env('test-token'), 'member@example.com');
    expect(result.status).toBe('synced');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'PUT')).toHaveLength(1);
  });
});
