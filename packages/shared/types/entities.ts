// =============================================================================
// Shared Types — Entity definitions (DD-31 §4–9)
// Implements: EP §8 (single source of truth)
// Every field name matches DD-31 column names exactly.
// Optional fields use undefined (DR-006), never null.
// ============================================================================
// ---------------------------------------------------------------------------
// 4.1 Tenant billing lifecycle
// ---------------------------------------------------------------------------
export type TenantBillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'purge_scheduled'
  | 'purged';
// 4.2 Visit status
export type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
// 4.3 Payment tender type
export type TenderType = 'credit' | 'cash' | 'check' | 'package' | 'membership';
// 4.4 Liability account type
export type LiabilityAccountType = 'deferred_revenue' | 'revenue';
// 4.5 Cost type
export type CostType = 'consumables' | 'variable_compensation';
// 4.6 Revenue type
export type RevenueType = 'earned' | 'package_redemption' | 'membership';
// 4.7 Provider role
export type ProviderRole = 'injector' | 'esthetician' | 'manager' | 'admin';
// 4.8 Compensation model
export type CompensationModel = 'flat' | 'percentage' | 'tiered';
// 4.9 Product type
export type ProductType =
  | 'neuromodulator'
  | 'dermal_filler'
  | 'skincare'
  | 'retail'
  | 'disposable';
// 4.10 Room type
export type RoomType = 'treatment' | 'consultation' | 'laser' | 'general';
// 4.11 Extraction run status
export type ExtractionStatus = 'running' | 'completed' | 'failed' | 'skipped';
// 4.12 Program run status
export type ProgramStatus = 'running' | 'completed' | 'failed' | 'blocked';
// 4.13 Error class (Principle 21)
export type ErrorClass = 'OUR_BUG' | 'UPSTREAM_DOWN' | 'INFRA' | 'DATA_QUALITY' | 'CONFIG';
// 4.14 Patient status
export type PatientStatus = 'active' | 'churned' | 'inactive';
// 4.15 User role (config_users.role)
export type UserRole = 'owner' | 'admin' | 'clinical' | 'staff' | 'readonly';
// ---------------------------------------------------------------------------
// Provenance columns — shared across all business tables (DD-31 §5)
// ---------------------------------------------------------------------------
export interface ProvenanceColumns {
  created_at: string;
  updated_at: string;
  created_by?: string;
  loaded_by_program?: string;
  loaded_by_version?: string;
  source?: string;
  source_id?: string;
}
// ---------------------------------------------------------------------------
// 9.1 config_tenants
// ---------------------------------------------------------------------------
export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  zenoti_api_key: string;
  zenoti_subdomain: string;
  pay_period_type: 'weekly' | 'biweekly';
  pay_period_anchor_day: number;
  timezone: string;
  billing_status: TenantBillingStatus;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}
// ---------------------------------------------------------------------------
// 9.2 config_users
// ---------------------------------------------------------------------------
export interface User {
  user_id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  role: 'owner' | 'admin' | 'clinical' | 'staff' | 'readonly';
  mfa_secret_encrypted?: string;
  login_attempts: number;
  locked_until?: string;
  last_login_at?: string;
  last_login_ip?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
// ---------------------------------------------------------------------------
// 5.1 dim_patients
// ---------------------------------------------------------------------------
export interface Patient extends ProvenanceColumns {
  
  patient_id: string;
  tenant_id: string;
  zenoti_patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  acquisition_source_id?: string;
  location_id: string;
  first_visit_date?: string;
  last_visit_date?: string;
  patient_status: PatientStatus;
  effective_start: string;
  effective_end: string;
}
// ---------------------------------------------------------------------------
// 5.2 dim_providers
// ---------------------------------------------------------------------------
export interface Provider extends ProvenanceColumns {
  provider_id: string;
  tenant_id: string;
  zenoti_employee_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: ProviderRole;
  compensation_model?: CompensationModel;
  base_rate?: number;
  commission_rate?: number;
  location_id: string;
  is_active: boolean;
  effective_start: string;
  effective_end: string;
}
// ---------------------------------------------------------------------------
// 5.3 dim_services
// ---------------------------------------------------------------------------
export interface Service extends ProvenanceColumns {
  service_id: string;
  tenant_id: string;
  zenoti_service_id: string;
  service_name: string;
  category_id: string;
  standard_duration_minutes?: number;
  list_price?: number;
  is_active: boolean;
  effective_start: string;
  effective_end: string;
}
// ---------------------------------------------------------------------------
// 5.4 dim_categories
// ---------------------------------------------------------------------------
export interface Category {
  category_id: string;
  tenant_id: string;
  category_name: string;
  parent_category_id?: string;
  is_reportable: boolean;
  display_order?: number;
  created_at: string;
  updated_at: string;
}
// ---------------------------------------------------------------------------
// 5.5 dim_locations
// ---------------------------------------------------------------------------
export interface Location extends ProvenanceColumns {
  location_id: string;
  tenant_id: string;
  zenoti_location_id: string;
  location_name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  timezone: string;
  is_active: boolean;
  is_enabled: boolean;
}
// ---------------------------------------------------------------------------
// 5.6 dim_rooms
// ---------------------------------------------------------------------------
export interface Room extends ProvenanceColumns {
  room_id: string;
  tenant_id: string;
  zenoti_room_id: string;
  room_name: string;
  location_id: string;
  room_type?: RoomType;
  capacity?: number;
  is_active: boolean;
}
// ---------------------------------------------------------------------------
// 5.7 dim_dates
// ---------------------------------------------------------------------------
export interface DateDim {
  date: string;
  day_of_week: number;
  day_name: string;
  month: number;
  month_name: string;
  quarter: number;
  year: number;
  year_month: string;
  year_quarter: string;
  is_weekend: boolean;
  is_holiday: boolean;
  holiday_name?: string;
  pay_period_start?: string;
  pay_period_end?: string;
  created_at: string;
}
// ---------------------------------------------------------------------------
// 5.8 dim_inventory_items
// ---------------------------------------------------------------------------
export interface InventoryItem extends ProvenanceColumns {
  
  item_id: string;
  tenant_id: string;
  zenoti_product_id: string;
  sku?: string;
  product_name: string;
  manufacturer?: string;
  brand_family?: string;
  product_type: ProductType;
  product_subtype?: string;
  unit_of_measure: string;
  units_per_package?: number;
  default_cost?: number;
  default_price?: number;
  is_active: boolean;
  effective_start: string;
  effective_end: string;
}
// ---------------------------------------------------------------------------
// 5.9 dim_inventory_lots
// ---------------------------------------------------------------------------
export interface InventoryLot extends ProvenanceColumns {
  lot_id: string;
  tenant_id: string;
  item_id: string;
  lot_number: string;
  received_date: string;
  expiration_date: string;
  vendor_id?: string;
  received_quantity: number;
  received_unit_cost: number;
  quantity_on_hand: number;
  is_expired: boolean;
}
