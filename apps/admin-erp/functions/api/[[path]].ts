interface PagesRequestContext {
  request: Request;
  env: {
    ERP_API_ORIGIN?: string;
  };
}

// The production API runs as its own Worker and owns the production D1/R2/KV
// bindings and SIGNED_URL_SECRET. Proxy same-origin Pages API requests to it;
// preserve the Cloudflare Access JWT so the API verifies the same session.
export const onRequest = async ({ request, env }: PagesRequestContext): Promise<Response> => {
  let apiOrigin: URL;
  try {
    apiOrigin = new URL(env.ERP_API_ORIGIN || '');
    if (apiOrigin.protocol !== 'https:' || apiOrigin.username || apiOrigin.password ||
        apiOrigin.search || apiOrigin.hash || apiOrigin.pathname !== '/') {
      throw new Error('Invalid ERP_API_ORIGIN');
    }
  } catch {
    return Response.json(
      { success: false, error: { code: 'API_CONFIGURATION_ERROR', message: 'The ERP API is not configured.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const incomingUrl = new URL(request.url);
  apiOrigin.pathname = incomingUrl.pathname;
  apiOrigin.search = incomingUrl.search;

  try {
    const upstreamRequest = new Request(apiOrigin.toString(), request);
    // The API uses the Access JWT assertion, not browser cookies. Do not send
    // the Pages Access session cookie to the separate Worker hostname.
    upstreamRequest.headers.delete('cookie');
    upstreamRequest.headers.delete('host');

    const upstreamResponse = await fetch(upstreamRequest, { redirect: 'manual' });
    const response = new Response(upstreamResponse.body, upstreamResponse);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return Response.json(
      { success: false, error: { code: 'API_UNAVAILABLE', message: 'The ERP API is temporarily unavailable.' } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
};
