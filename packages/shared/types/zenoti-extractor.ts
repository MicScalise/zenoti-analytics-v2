// =============================================================================
// Zenoti Extractor Interface — Shared interface for Zenoti API operations
// Implements: TASK-024, REQ-EXT-01
// Defect Registry: DR-043 (decouples workers from API package)
// =============================================================================

/**
 * Minimal interface for Zenoti API operations used by extraction workers.
 * Implemented by ZenotiClient in the API package.
 * Defined in shared package to avoid cross-package imports.
 */
export interface ZenotiExtractor {
  getPatients(centerId: string, updatedAfter?: string): Promise<unknown[]>;
  getAppointments(centerId: string, from: string, to: string): Promise<unknown[]>;
  getPayments(centerId: string, from: string, to: string): Promise<unknown[]>;
  getInventoryItems(centerId: string): Promise<unknown[]>;
  getInventoryLots(centerId: string): Promise<unknown[]>;
  getInventoryUsage(centerId: string, from: string, to: string): Promise<unknown[]>;
  getEmployees(centerId: string): Promise<unknown[]>;
  getServices(centerId: string): Promise<unknown[]>;
  getRooms(centerId: string): Promise<unknown[]>;
}
