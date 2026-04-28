// =============================================================================
// Integration Routes — Zenoti extraction and load API endpoints
// Implements: TASK-026, REQ-EXT-01
// Design: 32-api-contracts.md §11
// =============================================================================

import { Router } from 'express';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { triggerExtraction, triggerLoad, getExtractionRuns } from './services/sync-service.js';

/**
 * Create integration routes for Zenoti extraction/load management.
 * All routes require authentication and admin/M2M role.
 *
 * Endpoints:
 * - POST /integrations/zenoti/extract — trigger extraction job
 * - GET /integrations/zenoti/extraction-runs — list run history
 * - POST /integrations/zenoti/load — trigger load from completed run
 */
export function createIntegrationRoutes(db: Pool, logger: Logger): Router {
  const router = Router();

  // POST /integrations/zenoti/extract
  // Triggers extraction of a specific entity type for a tenant.
  // Rate limited: 1 per entity per tenant per hour.
  router.post('/extract', async (req, res, next) => {
    try {
      const { tenantId, centerId, entityType, from, to } = req.body;
      const userTenantId = req.user?.tenantId;

      // Verify user has access to this tenant
      if (userTenantId && userTenantId !== tenantId) {
        res.status(403).json({
          success: false,
          error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Tenant access denied' },
        });
        return;
      }

      // Guard G-1: check billing status for write operations
      const billingCheck = await db.query(
        `SELECT billing_status FROM config_tenants WHERE tenant_id = $1`,
        [tenantId]
      );
      if (billingCheck.rows.length > 0) {
        const status = billingCheck.rows[0].billing_status;
        if (!['trialing', 'active'].includes(status)) {
          res.status(403).json({
            success: false,
            error: { code: 'TENANT_SUSPENDED', message: 'Billing status blocks extraction' },
          });
          return;
        }
      }

      const extractionRunId = await triggerExtraction(
        db, tenantId, entityType, centerId, from, to, logger
      );

      res.status(202).json({
        success: true,
        data: { extractionRunId, status: 'running' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limited')) {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: error.message },
        });
        return;
      }
      next(error);
    }
  });

  // GET /integrations/zenoti/extraction-runs
  // Returns extraction run history with optional filters.
  router.get('/extraction-runs', async (req, res, next) => {
    try {
      const tenantId = req.query.tenantId as string ?? req.user?.tenantId;
      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' },
        });
        return;
      }

      const runs = await getExtractionRuns(db, tenantId, {
        centerId: req.query.centerId as string | undefined,
        entityType: req.query.entityType as string | undefined,
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });

      res.json({ success: true, data: runs });
    } catch (error) {
      next(error);
    }
  });

  // POST /integrations/zenoti/load
  // Triggers load from a completed extraction run.
  // M2M API key required (worker only).
  router.post('/load', async (req, res, next) => {
    try {
      const { extractionRunId } = req.body;
      const tenantId = req.user?.tenantId;
      const entityType = req.body.entityType ?? 'patients';

      if (!extractionRunId || !tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'extractionRunId and tenantId required' },
        });
        return;
      }

      const programRunId = await triggerLoad(
        db, tenantId, extractionRunId, entityType, logger
      );

      res.status(202).json({
        success: true,
        data: { programRunId, status: 'running' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('status is')) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.message },
        });
        return;
      }
      next(error);
    }
  });

  return router;
}
