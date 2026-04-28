// =============================================================================
// Reporting Module — Public API
// Implements: TASK-021 (module barrel export)
// ============================================================================

export { reportingRouter } from './routes.js';
export { getRevenueSummary, getRetentionCohorts, getNeuromodulatorProfitability } from './services/kpi-service.js';
export { getDashboard } from './services/dashboard-service.js';
export type { RevenueSummary, RetentionCohort, NeuromodulatorProfitability } from './services/kpi-service.js';
export type { DashboardKpi, DashboardResponse } from './services/dashboard-service.js';
