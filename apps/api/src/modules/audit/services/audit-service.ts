// =============================================================================
// import { _uuidv4 as uuidv4, _bcrypt as bcrypt } from '../../lib/stubs.js';
// Audit Service — Extraction run tracking
// Implements: OP-AUD-01 through OP-AUD-04 (DD-36 §9.1)
// Program runs in program-run-service.ts
// ============================================================================

import { pool } from '../../db.js';
// import { v4 as uuidv4 } from 'uuid'; // Stubbed
// import { startProgramRun, completeProgramRun, failProgramRun } from './program-run-service.js'; // Unused

// Re-export program run functions and types
export { startProgramRun, completeProgramRun, failProgramRun } from './program-run-service.js';
export type { ProgramRunResponse } from './program-run-service.js';

/** Extraction run response */
export interface ExtractionRunResponse {
  extractionRunId: string;
  tenantId: string;
  centerId: string | null;
  entityType: string;
  status: string;
  extractionStart: string;
  extractionEnd: string | null;
  recordsFetched: number | null;
  recordsLoaded: number | null;
  sourceFilePath: string | null;
  checksumSha256: string | null;
  errorMessage: string | null;
}

/**
 * Start an extraction run (status = 'running').
 * Implements OP-AUD-01.
 */
export async function startExtractionRun(
  tenantId: string, centerId: string | null, entityType: string
): Promise<{ extractionRunId: string; extractionStart: string }> {
  const extractionRunId = 'stub-uuid-' + Date.now();
  const { rows } = await pool.query(
    `INSERT INTO audit_extraction_runs (
      extraction_run_id, tenant_id, center_id, entity_type, status, extraction_start
    ) VALUES ($1, $2, $3, $4, 'running', NOW())
    RETURNING extraction_run_id, extraction_start;`,
    [extractionRunId, tenantId, centerId, entityType]
  );

  // DR-020: Verify
  const verify = await pool.query(
    `SELECT extraction_run_id FROM audit_extraction_runs
     WHERE extraction_run_id = $1 AND tenant_id = $2;`,
    [extractionRunId, tenantId]
  );
  if (verify.rows.length === 0) throw new Error('Extraction run verification failed');

  return { extractionRunId: rows[0].extraction_run_id, extractionStart: rows[0].extraction_start };
}

/**
 * Complete an extraction run successfully.
 * Implements OP-AUD-02.
 */
export async function completeExtractionRun(
  extractionRunId: string, tenantId: string,
  recordsFetched: number, recordsLoaded: number,
  sourceFilePath: string | null, checksumSha256: string | null
): Promise<ExtractionRunResponse | null> {
  const { rows } = await pool.query(
    `UPDATE audit_extraction_runs
    SET extraction_end = NOW(), status = 'completed',
        records_fetched = $2, records_loaded = $3,
        source_file_path = $4, checksum_sha256 = $5
    WHERE extraction_run_id = $1 AND tenant_id = $6
    RETURNING *;`,
    [extractionRunId, recordsFetched, recordsLoaded, sourceFilePath, checksumSha256, tenantId]
  );
  return rows.length > 0 ? mapExtractionRun(rows[0]) : null;
}

/**
 * Fail an extraction run.
 * Implements OP-AUD-03.
 */
export async function failExtractionRun(
  extractionRunId: string, errorMessage: string, tenantId: string
): Promise<void> {
  await pool.query(
    `UPDATE audit_extraction_runs
    SET extraction_end = NOW(), status = 'failed', error_message = $2
    WHERE extraction_run_id = $1 AND tenant_id = $3;`,
    [extractionRunId, errorMessage, tenantId]
  );
}

/**
 * Skip an extraction run (center disabled).
 * Implements OP-AUD-04.
 */
export async function skipExtractionRun(
  extractionRunId: string, reason: string, tenantId: string
): Promise<void> {
  await pool.query(
    `UPDATE audit_extraction_runs
    SET extraction_end = NOW(), status = 'skipped', error_message = $2
    WHERE extraction_run_id = $1 AND tenant_id = $3;`,
    [extractionRunId, reason, tenantId]
  );
}

/** Map extraction run row to response */
function mapExtractionRun(r: Record<string, unknown>): ExtractionRunResponse {
  return {
    extractionRunId: r.extraction_run_id as string, tenantId: r.tenant_id as string,
    centerId: r.center_id as string | null, entityType: r.entity_type as string,
    status: r.status as string, extractionStart: r.extraction_start as string,
    extractionEnd: r.extraction_end as string | null,
    recordsFetched: r.records_fetched as number | null,
    recordsLoaded: r.records_loaded as number | null,
    sourceFilePath: r.source_file_path as string | null,
    checksumSha256: r.checksum_sha256 as string | null,
    errorMessage: r.error_message as string | null,
  };
}
