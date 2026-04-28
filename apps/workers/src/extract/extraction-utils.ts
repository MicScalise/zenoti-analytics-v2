// =============================================================================
// Extraction Worker — Shared utilities for all entity extractors
// Implements: TASK-024, REQ-EXT-01, REQ-EXT-02
// Design: api-extraction-specification.md §3–4, 33-state-models.md §5 (SM-EXT-01)
// Defect Registry: DR-043 (extraction writes raw.jsonl ONLY; loader calls stored procs)
// =============================================================================

import { createHash } from 'crypto';
import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Pool } from 'pg';

// ZenotiExtractor is defined in the shared package to avoid cross-package imports
// Re-export for convenience
export type { ZenotiExtractor } from '@za/shared/types';

// ---------------------------------------------------------------------------
// Extraction Run Lifecycle (SM-EXT-01: running → completed|failed|skipped)
// ---------------------------------------------------------------------------

/** Entity types that can be extracted from Zenoti */
export type EntityType =
  | 'patients'
  | 'appointments'
  | 'sales'
  | 'inventory_items'
  | 'inventory_lots'
  | 'inventory_usage'
  | 'employees'
  | 'services'
  | 'rooms'
  | 'packages'
  | 'memberships'
  | 'membership_billing';

/** Extraction run states per SM-EXT-01 */
export type ExtractionStatus = 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Create an audit_extraction_runs row with status='running'.
 * Implements SM-EXT-01 initial state transition.
 *
 * @param db — Database pool
 * @param tenantId — Tenant UUID
 * @param centerId — Center/location UUID (nullable for full-tenant extractions)
 * @param entityType — Entity being extracted
 * @returns extraction_run_id
 */
export async function createExtractionRun(
  db: Pool,
  tenantId: string,
  centerId: string | null,
  entityType: EntityType
): Promise<string> {
  const runId = crypto.randomUUID();
  await db.query(
    `INSERT INTO audit_extraction_runs (
      extraction_run_id, tenant_id, center_id, entity_type, status, extraction_start
    ) VALUES ($1, $2, $3, $4, 'running', NOW())
    RETURNING extraction_run_id`,
    [runId, tenantId, centerId, entityType]
  );
  return runId;
}

/**
 * Mark an extraction run as completed (SM-EXT-01: running → completed).
 */
export async function completeExtractionRun(
  db: Pool,
  extractionRunId: string,
  tenantId: string,
  recordsFetched: number,
  recordsLoaded: number,
  sourceFilePath: string,
  checksumSha256: string
): Promise<void> {
  await db.query(
    `UPDATE audit_extraction_runs
     SET extraction_end = NOW(), status = 'completed',
         records_fetched = $2, records_loaded = $3,
         source_file_path = $4, checksum_sha256 = $5
     WHERE extraction_run_id = $1 AND tenant_id = $6`,
    [extractionRunId, recordsFetched, recordsLoaded, sourceFilePath, checksumSha256, tenantId]
  );
}

/**
 * Mark an extraction run as failed (SM-EXT-01: running → failed).
 */
export async function failExtractionRun(
  db: Pool,
  extractionRunId: string,
  tenantId: string,
  errorMessage: string
): Promise<void> {
  await db.query(
    `UPDATE audit_extraction_runs
     SET extraction_end = NOW(), status = 'failed', error_message = $2
     WHERE extraction_run_id = $1 AND tenant_id = $3`,
    [extractionRunId, errorMessage, tenantId]
  );
}

/**
 * Mark an extraction run as skipped (SM-EXT-01: running → skipped).
 * Used when center is_enabled=false (G-4).
 */
export async function skipExtractionRun(
  db: Pool,
  extractionRunId: string,
  tenantId: string,
  reason: string
): Promise<void> {
  await db.query(
    `UPDATE audit_extraction_runs
     SET extraction_end = NOW(), status = 'skipped', error_message = $2
     WHERE extraction_run_id = $1 AND tenant_id = $3`,
    [extractionRunId, reason, tenantId]
  );
}

// ---------------------------------------------------------------------------
// Raw JSONL Writer (DR-043: extraction writes raw.jsonl ONLY)
// ---------------------------------------------------------------------------

/**
 * Write records to a raw.jsonl file and compute SHA-256 checksum.
 * DR-043: Extraction workers write raw.jsonl; load workers call stored procedures.
 *
 * @param filePath — Path to the raw.jsonl file
 * @param records — Array of JSON-serializable records
 * @returns SHA-256 hex checksum of the file contents
 */
export async function writeRawJsonl(
  filePath: string,
  records: unknown[]
): Promise<string> {
  await mkdir(dirname(filePath), { recursive: true });

  const lines: string[] = [];
  const hash = createHash('sha256');

  for (const record of records) {
    const line = JSON.stringify(record) + '\n';
    lines.push(line);
    hash.update(line);
  }

  for (const line of lines) {
    await appendFile(filePath, line, 'utf-8');
  }

  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Guard Checks (from DD-35 §6)
// ---------------------------------------------------------------------------

/**
 * Check if a center is enabled for extraction (Guard G-4).
 */
export async function isCenterEnabled(db: Pool, centerId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT is_enabled FROM dim_locations WHERE location_id = $1`,
    [centerId]
  );
  return result.rows.length > 0 && result.rows[0].is_enabled === true;
}

/**
 * Check tenant billing status for write access (Guard G-1).
 */
export async function isTenantWriteAllowed(db: Pool, tenantId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT billing_status FROM config_tenants WHERE tenant_id = $1`,
    [tenantId]
  );
  if (result.rows.length === 0) return false;
  return ['trialing', 'active'].includes(result.rows[0].billing_status);
}

/**
 * Get all enabled centers for a tenant.
 */
export async function getEnabledCenters(db: Pool, tenantId: string): Promise<Array<{
  location_id: string;
  zenoti_location_id: string;
  timezone: string;
}>> {
  const result = await db.query(
    `SELECT location_id, zenoti_location_id, timezone
     FROM dim_locations
     WHERE tenant_id = $1 AND is_enabled = true AND is_active = true`,
    [tenantId]
  );
  return result.rows;
}
