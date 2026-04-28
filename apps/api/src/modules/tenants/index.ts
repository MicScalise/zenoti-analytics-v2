// =============================================================================
// Tenants Module — Public API
// Implements: TASK-016 (module barrel export)
// ============================================================================

export { tenantsRouter } from './routes.js';
export { getTenantById, getBillingStatus, updateTenant, listLocations, deactivateLocation } from './services/tenant-service.js';
export type { TenantResponse, LocationResponse } from './services/tenant-service.js';
