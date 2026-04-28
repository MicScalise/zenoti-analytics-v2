// =============================================================================
// Auth Middleware — JWT and session verification, AsyncLocalStorage context
// Implements: TASK-027, NFR-SEC-01, NFR-SEC-02
// Design: 35-security-and-observability.md §3–4
// Defect Registry: DR-037 (no (req as any) casts)
// =============================================================================

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Redis as RedisType } from 'ioredis';

/** User session data stored in Redis and attached to requests */
export interface UserSession {
  tid: string; // Alias for tenantId
  uid: string; // Alias for userId
  userId: string;
  tenantId: string;
  role: string;
  mfaSatisfied: boolean;
}

/** JWT payload structure for mobile access tokens */
interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Create authentication middleware that validates session cookies or JWT tokens.
 * Sets req.user with the authenticated user's session data.
 *
 * Supports three auth methods (DD-35 §3):
 * 1. Web: session cookie → Redis lookup
 * 2. Mobile: Bearer JWT → signature + claims verification
 * 3. M2M: ApiKey header → tenant API key validation
 *
 * @param redis — Redis client for session storage
 * @param jwtPublicKey — RS256 public key for JWT verification
 */
export function createAuthMiddleware(redis: RedisType, jwtPublicKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Method 1: Session cookie (web clients)
      const sessionId = req.cookies?.sessionId;
      if (sessionId) {
        const sessionData = await redis.get(`session:${sessionId}`);
        if (sessionData) {
          req.user = JSON.parse(sessionData) as UserSession;
          await redis.expire(`session:${sessionId}`, 1800);
          next();
          return;
        }
      }

      // Method 2: Bearer JWT (mobile clients)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, jwtPublicKey, {
          algorithms: ['RS256'],
        }) as JwtPayload;

        req.user = {
          userId: payload.userId,
          tenantId: payload.tenantId,
          role: payload.role,
          tid: payload.tenantId,
          uid: payload.userId,
          mfaSatisfied: true,
        };
        next();
        return;
      }

      // Method 3: API Key (M2M workers)
      const apiKey = req.headers.authorization?.startsWith('ApiKey ')
        ? req.headers.authorization.slice(8)
        : null;
      if (apiKey) {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
          res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'X-Tenant-Id header required' },
          });
          return;
        }
        const tenantData = await redis.get(`apikey:${apiKey}`);
        if (tenantData) {
          const parsed = JSON.parse(tenantData);
          if (parsed.tenantId === tenantId) {
            req.user = { userId: 'system', tenantId, tid: tenantId, uid: 'system', role: 'owner', mfaSatisfied: true };
            next();
            return;
          }
        }
      }

      // No valid auth method found
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Authentication required' },
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid or expired token' },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Role-based access control middleware.
 * Returns 403 if user's role is not in the allowed list.
 *
 * @param allowedRoles — Roles permitted to access the route
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Authentication required' },
      });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role permissions' },
      });
      return;
    }
    next();
  };
}

/**
 * MFA verification middleware.
 * Returns 423 if user has not satisfied MFA challenge.
 */
export function requireMfa(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.mfaSatisfied) {
    res.status(423).json({
      success: false,
      error: { code: 'MFA_REQUIRED', message: 'MFA verification required' },
    });
    return;
  }
  next();
}
