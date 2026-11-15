import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../src/types/env';
import { syncApprovedEmailToCloudflareAccess } from '../src/services/cloudflareAccess';

const env = (token?: string) => ({
  CF_ACCESS_API_TOKEN: token,
} as Bindings);

const policy = {
  id: '3fe62b03-bb97-47d3-8839-02001fee7ce0',
  name: 'Allow approved Paws Hopes Society members',
  decision: 'allow',
  include: [{ email: { email: 'hopezpaws@gmail.com' } }],
  exclude: [],
  require: [],
  precedence: 1,
};

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

  it('adds only the exact approved email and preserves existing policy rules', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: policy }), { status: 200 }))
      .mockImplementationOnce(async (_url, init) => {
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
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT');
  });

  it('does not modify a policy containing a broad Everyone rule', async () => {
    const broadPolicy = { ...policy, include: [{ everyone: {} }] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: broadPolicy }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncApprovedEmailToCloudflareAccess(env('test-token'), 'member@example.com');

    expect(result.status).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate an email already present in the Allow policy', async () => {
    const existingPolicy = {
      ...policy,
      include: [...policy.include, { email: { email: 'member@example.com' } }],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: existingPolicy }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncApprovedEmailToCloudflareAccess(env('test-token'), 'member@example.com');

    expect(result.status).toBe('synced');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
