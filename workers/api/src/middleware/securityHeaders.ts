import { createMiddleware } from 'hono/factory';
import type { Bindings, AppVariables } from '../types/env';

export const securityHeaders = createMiddleware<{
  Bindings: Bindings;
  Variables: AppVariables;
}>(async (c, next) => {
  const reqId = crypto.randomUUID();
  c.set('requestId', reqId);
  await next();

  c.header('X-Request-Id', reqId);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none';"
  );
  if (c.env.ENVIRONMENT !== 'development') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
});
