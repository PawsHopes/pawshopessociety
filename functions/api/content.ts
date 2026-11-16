interface PagesContext {
  request: Request;
}

const ERP_PUBLIC_CONTENT_URL = 'https://pawshopes-erp-api.hopezpaws.workers.dev/api/v1/public/content';

export const onRequestGet = async (_context: PagesContext): Promise<Response> => {
  try {
    const upstream = await fetch(ERP_PUBLIC_CONTENT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.delete('set-cookie');
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  } catch {
    return Response.json(
      { success: false, error: { code: 'CMS_FEED_UNAVAILABLE', message: 'Website updates are temporarily unavailable.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  }
};
