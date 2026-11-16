interface PagesContext { request: Request; params: { path?: string }; }
const PRODUCTION_API_ORIGIN = 'https://pawshopes-erp-api.hopezpaws.workers.dev';
export const onRequest = async ({ request }: PagesContext): Promise<Response> => {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(PRODUCTION_API_ORIGIN);
  upstreamUrl.pathname = incomingUrl.pathname;
  upstreamUrl.search = incomingUrl.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  try {
    const upstream = await fetch(new Request(upstreamUrl.toString(), {
      method: request.method, headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    }));
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch {
    return Response.json({ success: false, error: { code: 'ERP_API_UNAVAILABLE', message: 'The Society ERP API is temporarily unavailable.' } }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
};
