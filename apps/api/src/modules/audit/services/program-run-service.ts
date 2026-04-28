// =============================================================================
// Program Run Service — Audit program run tracking
// Implements: OP-AUD-05, OP-AUD-06, OP-AUD-07 (DD-36 §9.2)
// Extracted from audit-service.ts per 150-line rule
// ============================================================================

import { pool } from '../../db.js';

/** Program run response */
export interface ProgramRunResponse {
  programRunId: number;
  tenantId: string | null;
  programName: string;
  status: string;
  runStart: string;
  runEnd: string | null;
  outputSummary: Record<string, unknown> | null;
  errorClass: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Start a program run (status = 'running').
 * Implements OP-AUD-05.
 *
 * @param programName — name of the program being run
 * @param args — program arguments as JSON
 * @param tenantId — optional tenant UUID (null for system-wide programs)
 * @returns program run ID and start timestamp
 */
export async function startProgramRun(
  programName: string, args: Record<string, unknown>, tenantId?: string
): Promise<{ programRunId: number; runStart: string }> {
  const { rows } = await pool.query(
    `INSERT INTO audit_program_runs (tenant_id, program_name, args, status)
    VALUES ($1, $2, $3, 'running')
    RETURNING program_run_id, run_start;`,
    [tenantId ?? null, programName, JSON.stringify(args)]
  );
  return { programRunId: rows[0].program_run_id, runStart: rows[0].run_start };
}

/**
 * Complete a program run successfully.
 * Implements OP-AUD-06.
 *
 * @param programRunId — program run ID
 * @param outputSummary — summary of program output
 * @param tenantId — tenant UUID
 * @returns updated program run or null
 */
export async function completeProgramRun(
  programRunId: number, outputSummary: Record<string, unknown>, tenantId: string
): Promise<ProgramRunResponse | null> {
  const { rows } = await pool.query(
    `UPDATE audit_program_runs
    SET run_end = NOW(), status = 'completed', output_summary = $2
    WHERE program_run_id = $1 AND tenant_id = $3
    RETURNING *;`,
    [programRunId, JSON.stringify(outputSummary), tenantId]
  );
  return rows.length > 0 ? mapProgramRun(rows[0]) : null;
}

/**
 * Fail a program run with error details.
 * Implements OP-AUD-07.
 *
 * @param programRunId — program run ID
 * @param errorClass — error classification (per Principle 21)
 * @param errorCode — specific error code
 * @param errorMessage — human-readable error description
 * @param tenantId — tenant UUID
 */
export async function failProgramRun(
  programRunId: number, errorClass: string,
  errorCode: string, errorMessage: string, tenantId: string
): Promise<void> {
  await pool.query(
    `UPDATE audit_program_runs
    SET run_end = NOW(), status = 'failed',
        error_class = $2, error_code = $3, error_message = $4
    WHERE program_run_id = $1 AND tenant_id = $5;`,
    [programRunId, errorClass, errorCode, errorMessage, tenantId]
  );
}

/** Map program run row to response */
function mapProgramRun(r: Record<string, unknown>): ProgramRunResponse {
  return {
    programRunId: r.program_run_id as number, tenantId: r.tenant_id as string | null,
    programName: r.program_name as string, status: r.status as string,
    runStart: r.run_start as string, runEnd: r.run_end as string | null,
    outputSummary: r.output_summary as Record<string, unknown> | null,
    errorClass: r.error_class as string | null, errorCode: r.error_code as string | null,
    errorMessage: r.error_message as string | null,
  };
}
