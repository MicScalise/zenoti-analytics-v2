// =============================================================================
// Shared Types — Barrel export
// Implements: EP §8 (single source of truth)
// All types re-exported from this single module.
// ============================================================================

// Enums as union types (DD-31 §4)
export type {
  TenantBillingStatus,
  VisitStatus,
  TenderType,
  LiabilityAccountType,
  CostType,
  RevenueType,
  ProviderRole,
  CompensationModel,
  ProductType,
  RoomType,
  ExtractionStatus,
  ProgramStatus,
  ErrorClass,
  PatientStatus,
  UserRole,
} from './entities.js';

// Shared interfaces
export type { ProvenanceColumns } from './entities.js';

// Dimension + config entities (DD-31 §5, §9.1, §9.2)
export type {
  Tenant,
  User,
  Patient,
  Provider,
  Service,
  Category,
  Location,
  Room,
  DateDim,
  InventoryItem,
  InventoryLot,
} from './entities.js';

// Fact, reference, audit entities (DD-31 §6–9)
export type {
  AcquisitionSource,
  MembershipType,
  Visit,
  VisitService,
  Payment,
  PackageRedemption,
  MembershipBilling,
  InventoryUsage,
  RevenueEvent,
  CostEvent,
  ProviderHours,
  RoomHours,
  ServiceCostRule,
  OverheadAllocationRule,
  PricingRule,
  ProviderPayRule,
  ExtractionRun,
  ProgramRun,
  DataChange,
} from './entities-extended.js';

// Zenoti extractor interface (shared between API and workers)
export type { ZenotiExtractor } from './zenoti-extractor.js';

// API types (DD-32 §3)
export type {
  ApiResponse,
  ApiError,
  ApiMeta,
  PaginationParams,
  DateRangeFilter,
  TenantScopedRequest,
  LoginRequest,
  LoginResponse,
  PublicUser,
  RefreshRequest,
  KpiQueryParams,
  RevenueSummary,
} from './api.js';
