// =============================================================================
// Rate Limiter Middleware — Per-IP, per-user, per-tenant rate limiting
// Implements: TASK-027, NFR-SEC-02
// Design: 35-security-and-observability.md §15, 32-api-contracts.md §15
// =============================================================================

import { NextFunction, Request, Response } from 'express';
import { Redis as RedisType } from 'ioredis';

/** Rate limit configuration for different scopes */
interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Redis key prefix */
  prefix: string;
}

/** Default rate limit configurations per DD-32 §15 */
const LIMITS: Record<string, RateLimitConfig> = {
  login: { limit: 5, windowSeconds: 60, prefix: 'rl:login' },
  user: { limit: 300, windowSeconds: 60, prefix: 'rl:user' },
  tenant: { limit: 10000, windowSeconds: 60, prefix: 'rl:tenant' },
};

/**
 * Resolve the rate limit key based on scope and request context.
 */
function resolveKey(scope: string, req: Request, config: RateLimitConfig): string {
  switch (scope) {
    case 'login':
      return `${config.prefix}:${req.ip}`;
    case 'user':
      return req.user
        ? `${config.prefix}:${req.user.userId}`
        : `${config.prefix}:${req.ip}`;
    case 'tenant':
      return req.user
        ? `${config.prefix}:${req.user.tenantId}`
        : `${config.prefix}:${req.ip}`;
    default:
      return `${config.prefix}:${req.ip}`;
  }
}

/**
 * Create a rate limiter middleware using Redis for distributed counting.
 * Returns 429 with Retry-After header when limit is exceeded.
 *
 * @param redis — Redis client
 * @param scope — Rate limit scope: 'login', 'user', or 'tenant'
 */
export function createRateLimiter(redis: RedisType, scope: keyof typeof LIMITS) {
  const config = LIMITS[scope];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = resolveKey(scope, req, config);

    try {
      // Increment counter using Redis INCR with expiry
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, config.windowSeconds);
      }

      // Check if limit exceeded
      if (count > config.limit) {
        const ttl = await redis.ttl(key);
        res.set('Retry-After', String(Math.max(ttl, 1)));
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Rate limit exceeded: ${config.limit} requests per ${config.windowSeconds}s`,
          },
        });
        return;
      }

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(config.limit));
      res.set('X-RateLimit-Remaining', String(Math.max(config.limit - count, 0)));

      next();
    } catch (error) {
      // Redis failure should not block requests — fail open
      console.error('Rate limiter Redis error:', error);
      next();
    }
  };
}
