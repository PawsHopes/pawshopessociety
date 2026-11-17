interface PagesRequestContext {
  request: Request;
  env: {
    ERP_API?: {
      fetch: (request: Request) => Promise<Response>;
    };
  };
}

// The production API Worker owns the production D1/R2/KV bindings and
// SIGNED_URL_SECRET. Use a Cloudflare service binding so same-origin browser
// requests reach that Worker without exposing database bindings to Pages.
export const onRequest = async ({ request, env }: PagesRequestContext): Promise<Response> => {
  if (!env.ERP_API) {
    return Response.json(
      { success: false, error: { code: 'API_CONFIGURATION_ERROR', message: 'The ERP API service binding is not configured.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const forwardedHeaders = new Headers(request.headers);
    // The API authenticates the Cloudflare Access JWT assertion. Its session
    // cookie is not needed by the Worker and is not forwarded.
    forwardedHeaders.delete('cookie');
    const upstreamRequest = new Request(request, { headers: forwardedHeaders });
    const upstreamResponse = await env.ERP_API.fetch(upstreamRequest);
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
