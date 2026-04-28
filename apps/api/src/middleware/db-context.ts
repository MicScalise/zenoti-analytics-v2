// =============================================================================
// Database Context Middleware — Sets app.tenant_id and app.user_id per transaction
// Implements: TASK-027, NFR-SEC-01
// Design: 35-security-and-observability.md §5 (SET LOCAL for PgBouncer)
// Defect Registry: DR-034 (tenant_id from auth context, not request body)
// =============================================================================

import { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';

/**
 * Create DB context middleware that sets app.tenant_id and app.user_id
 * at the start of each request's database interaction.
 *
 * Uses SET LOCAL (transaction-scoped) for PgBouncer compatibility (DD-35 §5).
 * MUST be called within a transaction for SET LOCAL to take effect.
 *
 * @param db — Database pool
 */
export function createDbContextMiddleware(db: Pool) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next();
      return;
    }

    try {
      // OP-CONTEXT-01 from DD-36 §2
      // SET LOCAL is transaction-scoped — safe for PgBouncer transaction mode
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [req.user.tenantId]);
        await client.query("SELECT set_config('app.user_id', $1, true)", [req.user.userId]);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
