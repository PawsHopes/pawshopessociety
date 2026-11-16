interface PagesEnv {
  ERP_API_ORIGIN?: string;
}

interface PagesContext {
  request: Request;
  params: { path?: string };
  env: PagesEnv;
}

export const onRequest = async ({ request, env }: PagesContext): Promise<Response> => {
  const configuredOrigin = env.ERP_API_ORIGIN?.trim();
  if (!configuredOrigin) {
    return Response.json(
      { success: false, error: { code: 'ERP_API_NOT_CONFIGURED', message: 'The Society ERP API endpoint is not configured for this environment.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(configuredOrigin);
    if (upstreamUrl.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    return Response.json(
      { success: false, error: { code: 'ERP_API_CONFIGURATION_INVALID', message: 'The Society ERP API endpoint configuration is invalid.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const incomingUrl = new URL(request.url);
  upstreamUrl.pathname = incomingUrl.pathname;
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');

  try {
    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });
    const upstream = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { success: false, error: { code: 'ERP_API_UNAVAILABLE', message: 'The Society ERP API is temporarily unavailable.' } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
