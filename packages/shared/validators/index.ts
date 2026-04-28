// =============================================================================
// Zod Validators — Barrel export
// Implements: EP §8 (single source of truth)
// ============================================================================

export {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  type LoginInput,
  type RefreshInput,
  type ChangePasswordInput,
} from './auth.js';

export {
  createPatientSchema,
  updatePatientSchema,
  patientQuerySchema,
  type CreatePatientInput,
  type UpdatePatientInput,
  type PatientQueryInput,
} from './patient.js';

export {
  createVisitSchema,
  updateVisitStatusSchema,
  visitQuerySchema,
  type CreateVisitInput,
  type UpdateVisitStatusInput,
  type VisitQueryInput,
} from './appointment.js';

export {
  createPaymentSchema,
  createRedemptionSchema,
  salesQuerySchema,
  type CreatePaymentInput,
  type CreateRedemptionInput,
  type SalesQueryInput,
} from './sales.js';

export {
  createInventoryItemSchema,
  createInventoryLotSchema,
  createInventoryUsageSchema,
  inventoryQuerySchema,
  type CreateInventoryItemInput,
  type CreateInventoryLotInput,
  type CreateInventoryUsageInput,
  type InventoryQueryInput,
} from './inventory.js';

export {
  kpiQuerySchema,
  revenueQuerySchema,
  costQuerySchema,
  retentionQuerySchema,
  syncTriggerSchema,
  type KpiQueryInput,
  type RevenueQueryInput,
  type CostQueryInput,
  type RetentionQueryInput,
  type SyncTriggerInput,
} from './reporting.js';
