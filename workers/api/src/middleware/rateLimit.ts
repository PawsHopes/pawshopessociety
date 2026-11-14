import { createMiddleware } from 'hono/factory';
import type { Bindings, AppVariables } from '../types/env';

export function rateLimit(options: { bucket: string; maxRequests: number; windowSeconds: number }) {
  return createMiddleware<{
    Bindings: Bindings;
    Variables: AppVariables;
  }>(async (c, next) => {
    if (!c.env.RATE_LIMIT_KV) {
      return next();
    }
    const ip = c.req.header('CF-Connecting-IP') || 'unknown-ip';
    const windowId = Math.floor(Date.now() / 1000 / options.windowSeconds);
    const key = `rl:${options.bucket}:${ip}:${windowId}`;

    const currentStr = await c.env.RATE_LIMIT_KV.get(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;

    if (current >= options.maxRequests) {
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

    await c.env.RATE_LIMIT_KV.put(key, String(current + 1), {
      expirationTtl: options.windowSeconds + 60,
    });

    return next();
  });
}
