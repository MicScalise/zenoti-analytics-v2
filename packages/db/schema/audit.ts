// =============================================================================
// DB Schema — Audit table type exports (DD-31 §9.3–9.5)
// Implements: EP §8, EP §15
// Types mirror DD-31 column names exactly.
// ============================================================================

import type {
  ExtractionRun,
  ProgramRun,
  DataChange,
  ExtractionStatus,
  ProgramStatus,
  ErrorClass,
} from '@za/shared';

// Re-export entity types as row types
export type AuditExtractionRunRow = ExtractionRun;
export type AuditProgramRunRow = ProgramRun;
export type AuditDataChangeRow = DataChange;

/** Insert params for audit_extraction_runs — matches DD-31 §9.3 */
export interface InsertExtractionRunParams {
  tenant_id: string;
  center_id?: string;
  entity_type: string;
  status?: ExtractionStatus;
}

/** Update params for completing/failing/skipping an extraction run */
export interface UpdateExtractionRunParams {
  extraction_run_id: string;
  status: ExtractionStatus;
  extraction_end?: string;
  records_fetched?: number;
  records_loaded?: number;
  error_message?: string;
  source_file_path?: string;
  checksum_sha256?: string;
}

/** Insert params for audit_program_runs — matches DD-31 §9.4 */
export interface InsertProgramRunParams {
  tenant_id?: string;
  program_name: string;
  args?: Record<string, unknown>;
  status?: ProgramStatus;
  host?: string;
  code_version?: string;
}

/** Update params for completing/failing a program run */
export interface UpdateProgramRunParams {
  program_run_id: number;
  status: ProgramStatus;
  run_end?: string;
  output_summary?: string;
  error_class?: ErrorClass;
  error_code?: string;
  error_message?: string;
  log_path?: string;
}
