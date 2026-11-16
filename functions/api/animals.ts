interface PagesContext {
  request: Request;
}

const ERP_PUBLIC_ANIMALS_URL = 'https://pawshopes-erp-api.hopezpaws.workers.dev/api/v1/public/animals';

/**
 * Public animal listings are served from the isolated production ERP database.
 * This keeps the public website in sync with the approved Admin ERP workflow
 * without granting the public Pages project direct access to ERP D1.
 */
export const onRequestGet = async ({ request }: PagesContext): Promise<Response> => {
  try {
    const upstream = await fetch(ERP_PUBLIC_ANIMALS_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.delete('set-cookie');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return Response.json(
      { success: false, error: { code: 'ANIMAL_FEED_UNAVAILABLE', message: 'Animal listings are temporarily unavailable.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  }
};
