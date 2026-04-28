// =============================================================================
// DB Schema — Fact table type exports (DD-31 §6)
// Implements: EP §8, EP §15
// Types mirror DD-31 column names exactly.
// ============================================================================

import type {
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
  VisitStatus,
  TenderType,
  RevenueType,
  CostType,
} from '@za/shared';

// Re-export entity types as row types for typed query results
export type FctVisitRow = Visit;
export type FctVisitServiceRow = VisitService;
export type FctPaymentRow = Payment;
export type FctPackageRedemptionRow = PackageRedemption;
export type FctMembershipBillingRow = MembershipBilling;
export type FctInventoryUsageRow = InventoryUsage;
export type FctRevenueEventRow = RevenueEvent;
export type FctCostEventRow = CostEvent;
export type FctProviderHoursRow = ProviderHours;
export type FctRoomHoursRow = RoomHours;

/** Insert params for fct_visits — matches DD-31 §6.1 columns exactly */
export interface InsertVisitParams {
  tenant_id: string;
  zenoti_visit_id: string;
  patient_id: string;
  provider_id?: string;
  room_id?: string;
  location_id: string;
  appointment_id?: string;
  visit_date: string;
  actual_start?: string;
  actual_end?: string;
  scheduled_duration_minutes?: number;
  actual_duration_minutes?: number;
  visit_status?: VisitStatus;
  is_new_patient_visit?: boolean;
  no_show_flag?: boolean;
}

/** Insert params for fct_visit_services — matches DD-31 §6.2 columns exactly */
export interface InsertVisitServiceParams {
  tenant_id: string;
  zenoti_visit_service_id: string;
  visit_id: string;
  service_id: string;
  provider_id?: string;
  category_id: string;
  quantity: number;
  gross_revenue: number;
  discounts?: number;
  net_revenue: number;
  earned_date: string;
}

/** Insert params for fct_payments — matches DD-31 §6.3 columns exactly */
export interface InsertPaymentParams {
  tenant_id: string;
  zenoti_payment_id: string;
  patient_id: string;
  visit_id?: string;
  package_id?: string;
  membership_id?: string;
  payment_date: string;
  amount: number;
  tender_type: TenderType;
  liability_account_type?: string;
}

/** Insert params for fct_inventory_usage — matches DD-31 §6.6 columns exactly */
export interface InsertInventoryUsageParams {
  tenant_id: string;
  zenoti_usage_id?: string;
  visit_service_id: string;
  lot_id: string;
  inventory_item_id: string;
  usage_date: string;
  quantity_used: number;
  unit_cost_at_time: number;
  extended_cost: number;
  treatment_area?: string;
}

/** Insert params for fct_revenue_events — matches DD-31 §6.7 columns exactly */
export interface InsertRevenueEventParams {
  tenant_id: string;
  patient_id: string;
  visit_id?: string;
  visit_service_id?: string;
  provider_id?: string;
  category_id: string;
  location_id: string;
  revenue_type: RevenueType;
  earned_date: string;
  earned_amount: number;
  source_table: string;
  source_id: string;
}

/** Insert params for fct_cost_events — matches DD-31 §6.8 columns exactly */
export interface InsertCostEventParams {
  tenant_id: string;
  patient_id: string;
  visit_id?: string;
  visit_service_id: string;
  provider_id?: string;
  category_id: string;
  location_id: string;
  cost_type: CostType;
  recognized_date: string;
  direct_cost_amount: number;
  source_table: string;
  source_id: string;
}

/** Insert params for fct_provider_hours — matches DD-31 §6.9 columns exactly */
export interface InsertProviderHoursParams {
  tenant_id: string;
  provider_id: string;
  location_id: string;
  date: string;
  scheduled_hours: number;
  available_hours?: number;
  blocked_hours?: number;
  actual_hours?: number;
  loaded_by_program?: string;
}

/** Insert params for fct_room_hours — matches DD-31 §6.10 columns exactly */
export interface InsertRoomHoursParams {
  tenant_id: string;
  room_id: string;
  location_id: string;
  date: string;
  scheduled_hours: number;
  available_hours?: number;
  blocked_hours?: number;
  loaded_by_program?: string;
}
