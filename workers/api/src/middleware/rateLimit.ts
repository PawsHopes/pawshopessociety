import { createMiddleware } from 'hono/factory';
import type { Bindings, AppVariables } from '../types/env';

export function rateLimit(options: { bucket: string; maxRequests: number; windowSeconds: number }) {
  return createMiddleware<{
    Bindings: Bindings;
    Variables: AppVariables;
  }>(async (c, next) => {
    if (!c.env.RATE_LIMIT_KV) {
      if (c.env.ENVIRONMENT === 'production') {
        return c.json(
          { success: false, error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Request protection is temporarily unavailable.' } },
          503
        );
      }
      return next();
    }

    try {
      const ip = c.req.header('CF-Connecting-IP') || 'unknown-ip';
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
      const ipHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const windowId = Math.floor(Date.now() / 1000 / options.windowSeconds);
      const key = `rl:${options.bucket}:${ipHash}:${windowId}`;

      const currentStr = await c.env.RATE_LIMIT_KV.get(key);
      const parsedCurrent = currentStr === null ? 0 : Number.parseInt(currentStr, 10);
      const current = Number.isSafeInteger(parsedCurrent) && parsedCurrent >= 0 ? parsedCurrent : 0;

      if (current >= options.maxRequests) {
        c.header('Retry-After', String(options.windowSeconds - (Math.floor(Date.now() / 1000) % options.windowSeconds)));
        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please wait and try again.',
            },
          },
          429
        );
      }

      // KV counters are best-effort under concurrent requests; enforce strict edge limits with Cloudflare WAF rules too.
      await c.env.RATE_LIMIT_KV.put(key, String(current + 1), {
        expirationTtl: options.windowSeconds + 60,
      });
      return next();
    } catch {
      return c.json(
        { success: false, error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Request protection is temporarily unavailable.' } },
        503
      );
    }
  });
}
