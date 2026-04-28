// =============================================================================
// Audit Module — Public API
// Implements: TASK-022 (module barrel export)
// ============================================================================

export { auditRouter } from './routes.js';
export {
  startExtractionRun, completeExtractionRun, failExtractionRun, skipExtractionRun,
  startProgramRun, completeProgramRun, failProgramRun
} from './services/audit-service.js';
export type { ExtractionRunResponse } from './services/audit-service.js';
export type { ProgramRunResponse } from './services/program-run-service.js';
