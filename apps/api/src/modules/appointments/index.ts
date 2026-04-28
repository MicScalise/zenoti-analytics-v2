// =============================================================================
// Appointments Module — Public API
// Implements: TASK-018 (module barrel export)
// ============================================================================

export { appointmentsRouter } from './routes.js';
export {
  createVisit, getVisitById, listVisits,
  completeVisit, cancelVisit, markNoShow, addVisitService
} from './services/appointment-service.js';
export type { VisitResponse, CreateVisitInput } from './services/appointment-service.js';
