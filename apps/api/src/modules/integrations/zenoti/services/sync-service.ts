// =============================================================================
// Sync Service — Orchestrates extraction and load jobs via BullMQ
// Implements: TASK-026, REQ-EXT-01
// Design: 32-api-contracts.md §11, 34-sequence-flows.md §2 (SF-01)
// =============================================================================

import { Queue } from 'bullmq';
import type { Pool } from 'pg';
import type { Logger } from 'pino';

/** BullMQ queue for extraction jobs */
const extractQueue = new Queue('extraction', {
  connection: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
});

/** BullMQ queue for load jobs */
const loadQueue = new Queue('load', {
  connection: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
});

/**
 * Trigger an extraction job for a specific entity.
 * Enforces rate limit: 1 per entity per tenant per hour.
 *
 * @param db — Database pool
 * @param tenantId — Tenant UUID
 * @param entityType — Entity to extract
 * @param centerId — Optional center ID (uses all enabled centers if omitted)
 * @param from — ISO datetime start
 * @param to — ISO datetime end
 * @param logger — Structured logger
 * @returns extractionRunId from the created extraction run
 */
export async function triggerExtraction(
  db: Pool,
  tenantId: string,
  entityType: string,
  centerId: string | undefined,
  from: string | undefined,
  to: string | undefined,
  logger: Logger
): Promise<string> {
  // Rate limit check: recent extraction run for same entity/tenant?
  const recentRun = await db.query(
    `SELECT extraction_run_id FROM audit_extraction_runs
     WHERE tenant_id = $1 AND entity_type = $2
       AND extraction_start > NOW() - INTERVAL '1 hour'
       AND status IN ('running', 'completed')
     LIMIT 1`,
    [tenantId, entityType]
  );

  if (recentRun.rows.length > 0) {
    throw new Error(
      `Rate limited: extraction for ${entityType} already ran in the last hour`
    );
  }

  // Enqueue the extraction job
  const job = await extractQueue.add('extract', {
    tenantId,
    entityType,
    centerId: centerId ?? null,
    from: from ?? null,
    to: to ?? null,
  });

  logger.info({ jobId: job.id, tenantId, entityType }, 'Extraction job enqueued');
  return job.id ?? crypto.randomUUID();
}

/**
 * Trigger a load job for a completed extraction run.
 * Validates that the extraction run is in 'completed' state before enqueuing.
 *
 * @param db — Database pool
 * @param tenantId — Tenant UUID
 * @param extractionRunId — Completed extraction run ID
 * @param entityType — Entity type being loaded
 * @param logger — Structured logger
 * @returns programRunId
 */
export async function triggerLoad(
  db: Pool,
  tenantId: string,
  extractionRunId: string,
  entityType: string,
  logger: Logger
): Promise<string> {
  // Validate extraction run exists and is completed
  const run = await db.query(
    `SELECT status FROM audit_extraction_runs
     WHERE extraction_run_id = $1 AND tenant_id = $2`,
    [extractionRunId, tenantId]
  );

  if (run.rows.length === 0) {
    throw new Error(`Extraction run ${extractionRunId} not found`);
  }

  if (run.rows[0].status !== 'completed') {
    throw new Error(
      `Cannot load: extraction run ${extractionRunId} status is ${run.rows[0].status}, expected completed`
    );
  }

  // Enqueue the load job
  const job = await loadQueue.add('load', {
    tenantId,
    extractionRunId,
    entityType,
  });

  logger.info({ jobId: job.id, extractionRunId }, 'Load job enqueued');
  return job.id ?? crypto.randomUUID();
}

/**
 * Get extraction runs for a tenant with optional filters.
 * Implements GET /integrations/zenoti/extraction-runs from DD-32 §11.2.
 */
export async function getExtractionRuns(
  db: Pool,
  tenantId: string,
  filters: {
    centerId?: string;
    entityType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<unknown[]> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const result = await db.query(
    `SELECT extraction_run_id, tenant_id, center_id, entity_type,
            extraction_start, extraction_end, status,
            records_fetched, records_loaded, error_message
     FROM audit_extraction_runs
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR center_id = $2)
       AND ($3::text IS NULL OR entity_type = $3)
       AND ($4::text IS NULL OR status = $4::extraction_status)
     ORDER BY extraction_start DESC
     LIMIT $5 OFFSET $6`,
    [tenantId, filters.centerId ?? null, filters.entityType ?? null, filters.status ?? null, limit, offset]
  );

  return result.rows;
}
