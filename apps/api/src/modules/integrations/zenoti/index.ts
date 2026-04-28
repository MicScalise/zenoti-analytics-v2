// =============================================================================
// Integration Module Index — Exports routes and services for Zenoti integration
// Implements: TASK-026, REQ-EXT-01
// =============================================================================

export { createIntegrationRoutes } from './routes.js';
export { ZenotiClient, parseTimeToMinutes, extractDate } from './services/zenoti-client.js';
export type {
  ZenotiClientConfig,
  PatientRecord,
  AppointmentRecord,
  ServiceRecord,
  PaymentRecord,
  InventoryItemRecord,
  EmployeeRecord,
  RoomRecord,
} from './services/zenoti-client.js';
export { triggerExtraction, triggerLoad, getExtractionRuns } from './services/sync-service.js';
