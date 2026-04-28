// =============================================================================
// Appointment Load Worker — Calls load_visits stored procedure
// Implements: TASK-025, REQ-EXT-02
// Defect Registry: DR-043 (loader calls stored procedures ONLY)
// =============================================================================

import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { Logger } from 'pino';

/**
 * Load appointments from a completed extraction run's raw.jsonl.
 * Calls load_visits stored procedure (DR-043).
 */
export async function loadAppointments(
  db: Pool,
  tenantId: string,
  extractionRunId: string,
  logger: Logger
): Promise<void> {
  const runResult = await db.query(
    `SELECT source_file_path, checksum_sha256, status
     FROM audit_extraction_runs
     WHERE extraction_run_id = $1 AND tenant_id = $2`,
    [extractionRunId, tenantId]
  );

  if (runResult.rows.length === 0) {
    throw new Error(`Extraction run ${extractionRunId} not found`);
  }
  const run = runResult.rows[0];
  if (run.status !== 'completed') {
    throw new Error(`Extraction run not completed (status: ${run.status})`);
  }

  // Validate checksum
  const fileContent = await readFile(run.source_file_path, 'utf-8');
  const actualChecksum = createHash('sha256').update(fileContent).digest('hex');
  if (actualChecksum !== run.checksum_sha256) {
    throw new Error(`Checksum mismatch for ${run.source_file_path}`);
  }

  const records = fileContent.trim().split('\n').filter(Boolean);
  logger.info({ extractionRunId, recordCount: records.length }, 'Starting appointment load');

  const programResult = await db.query(
    `INSERT INTO audit_program_runs (tenant_id, program_name, args, status)
     VALUES ($1, 'load_visits', $2, 'running')
     RETURNING program_run_id`,
    [tenantId, JSON.stringify({ extractionRunId })]
  );
  const programRunId = programResult.rows[0].program_run_id;

  try {
    await db.query('SELECT load_visits($1, $2)', [extractionRunId, tenantId]);

    await db.query(
      `UPDATE audit_program_runs
       SET run_end = NOW(), status = 'completed', output_summary = $2
       WHERE program_run_id = $1 AND tenant_id = $3`,
      [programRunId, `Loaded ${records.length} appointments`, tenantId]
    );

    logger.info({ programRunId }, 'Appointment load completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.query(
      `UPDATE audit_program_runs
       SET run_end = NOW(), status = 'failed',
           error_class = 'DATA_QUALITY', error_code = 'SP_LOAD_FAILED',
           error_message = $2
       WHERE program_run_id = $1 AND tenant_id = $3`,
      [programRunId, message, tenantId]
    );
    throw error;
  }
}
