// =============================================================================
// Tenant Context Middleware — Sets app.tenant_id for RLS enforcement
// Implements: TASK-027, NFR-SEC-01
// Design: 35-security-and-observability.md §5
// =============================================================================

import { NextFunction, Request, Response } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

/** Tenant context stored in AsyncLocalStorage */
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

/** Global AsyncLocalStorage for tenant context */
export const tenantContextStore = new AsyncLocalStorage<TenantContext>();

/**
 * Middleware that propagates tenant ID from the authenticated user
 * into AsyncLocalStorage for downstream use.
 * Must be mounted AFTER auth middleware.
 */
export function tenantContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next();
    return;
  }

  const context: TenantContext = {
    tenantId: req.user.tenantId,
    userId: req.user.userId,
    role: req.user.role,
  };

  tenantContextStore.run(context, () => next());
}

/**
 * Get the current tenant context from AsyncLocalStorage.
 * Returns undefined if not in a request context.
 */
export function getTenantContext(): TenantContext | undefined {
  return tenantContextStore.getStore();
}
