// =============================================================================
// DB Schema — Barrel export
// Implements: EP §8 (single source of truth)
// All schema types re-exported from this single module.
// ============================================================================

// Config table types (DD-31 §9)
export type {
  ConfigTenantRow,
  ConfigUserRow,
  InsertTenantParams,
  InsertUserParams,
  UpdateUserParams,
} from './config.js';

// Dimension table types (DD-31 §5)
export type {
  DimPatientRow,
  DimProviderRow,
  DimServiceRow,
  DimCategoryRow,
  DimLocationRow,
  DimRoomRow,
  DimDateRow,
  DimInventoryItemRow,
  DimInventoryLotRow,
  DimAcquisitionSourceRow,
  DimMembershipTypeRow,
  InsertPatientParams,
  InsertProviderParams,
  InsertServiceParams,
  InsertLocationParams,
  InsertRoomParams,
  InsertInventoryItemParams,
  InsertInventoryLotParams,
} from './dimensions.js';

// Fact table types (DD-31 §6)
export type {
  FctVisitRow,
  FctVisitServiceRow,
  FctPaymentRow,
  FctPackageRedemptionRow,
  FctMembershipBillingRow,
  FctInventoryUsageRow,
  FctRevenueEventRow,
  FctCostEventRow,
  FctProviderHoursRow,
  FctRoomHoursRow,
  InsertVisitParams,
  InsertVisitServiceParams,
  InsertPaymentParams,
  InsertInventoryUsageParams,
  InsertRevenueEventParams,
  InsertCostEventParams,
  InsertProviderHoursParams,
  InsertRoomHoursParams,
} from './facts.js';

// Audit table types (DD-31 §9.3–9.5)
export type {
  AuditExtractionRunRow,
  AuditProgramRunRow,
  AuditDataChangeRow,
  InsertExtractionRunParams,
  UpdateExtractionRunParams,
  InsertProgramRunParams,
  UpdateProgramRunParams,
} from './audit.js';
