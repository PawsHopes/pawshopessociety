interface PagesEnv {
  ERP_PUBLIC_CONTENT_API_URL?: string;
}

interface PagesContext {
  env: PagesEnv;
}

const DEFAULT_CONTENT_API = 'https://pawshopes-erp-api-staging.hopezpaws.workers.dev/api/v1/public/content';

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const upstreamUrl = context.env.ERP_PUBLIC_CONTENT_API_URL || DEFAULT_CONTENT_API;
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json(
      { success: false, error: { code: 'CONTENT_FEED_UNAVAILABLE', message: 'Public content is temporarily unavailable.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
