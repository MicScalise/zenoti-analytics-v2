// =============================================================================
// Shared Types — Fact, Reference, and Audit entity definitions (DD-31 §6–9)
// Implements: EP §8 (single source of truth)
// Every field name matches DD-31 column names exactly.
// Optional fields use undefined (DR-006), never null.
// ============================================================================


// ---------------------------------------------------------------------------
// 5.10 dim_acquisition_sources
// ---------------------------------------------------------------------------
export interface AcquisitionSource {
  source_id: string;
  tenant_id: string;
  source_name: string;
  source_category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 5.11 dim_membership_types
// ---------------------------------------------------------------------------
export interface MembershipType {
  membership_type_id: string;
  tenant_id: string;
  membership_name: string;
  billing_frequency: 'monthly' | 'quarterly' | 'annually';
  recurring_fee: number;
  benefits_description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 6.1 fct_visits
// ---------------------------------------------------------------------------
export interface Visit {
  visit_id: string;
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
  visit_status: import('./entities.js').VisitStatus;
  is_new_patient_visit: boolean;
  no_show_flag: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 6.2 fct_visit_services
// ---------------------------------------------------------------------------
export interface VisitService {
  visit_service_id: string;
  tenant_id: string;
  zenoti_visit_service_id: string;
  visit_id: string;
  service_id: string;
  provider_id?: string;
  category_id: string;
  quantity: number;
  gross_revenue: number;
  discounts: number;
  net_revenue: number;
  earned_date: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 6.3 fct_payments
// ---------------------------------------------------------------------------
export interface Payment {
  payment_id: string;
  tenant_id: string;
  zenoti_payment_id: string;
  patient_id: string;
  visit_id?: string;
  package_id?: string;
  membership_id?: string;
  payment_date: string;
  amount: number;
  tender_type: import('./entities.js').TenderType;
  liability_account_type?: import('./entities.js').LiabilityAccountType;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 6.4 fct_package_redemptions
// ---------------------------------------------------------------------------
export interface PackageRedemption {
  redemption_id: string;
  tenant_id: string;
  zenoti_redemption_id: string;
  package_id: string;
  patient_id: string;
  visit_service_id: string;
  redemption_date: string;
  units_redeemed: number;
  recognized_revenue_amount: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 6.5 fct_membership_billing
// ---------------------------------------------------------------------------
export interface MembershipBilling {
  billing_id: string;
  tenant_id: string;
  zenoti_billing_id: string;
  membership_id: string;
  membership_type_id: string;
  patient_id: string;
  bill_date: string;
  amount_billed: number;
  amount_collected: number;
  coverage_period_start: string;
  coverage_period_end: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 6.6 fct_inventory_usage
// ---------------------------------------------------------------------------
export interface InventoryUsage {
  usage_id: string;
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
  created_at: string;
}

// ---------------------------------------------------------------------------
// 6.7 fct_revenue_events
// ---------------------------------------------------------------------------
export interface RevenueEvent {
  revenue_event_id: string;
  tenant_id: string;
  patient_id: string;
  visit_id?: string;
  visit_service_id?: string;
  provider_id?: string;
  category_id: string;
  location_id: string;
  revenue_type: import('./entities.js').RevenueType;
  earned_date: string;
  earned_amount: number;
  source_table: string;
  source_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 6.8 fct_cost_events
// ---------------------------------------------------------------------------
export interface CostEvent {
  cost_event_id: string;
  tenant_id: string;
  patient_id: string;
  visit_id?: string;
  visit_service_id: string;
  provider_id?: string;
  category_id: string;
  location_id: string;
  cost_type: import('./entities.js').CostType;
  recognized_date: string;
  direct_cost_amount: number;
  source_table: string;
  source_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 6.9 fct_provider_hours
// ---------------------------------------------------------------------------
export interface ProviderHours {
  provider_hour_id: string;
  tenant_id: string;
  provider_id: string;
  location_id: string;
  date: string;
  scheduled_hours: number;
  available_hours?: number;
  blocked_hours?: number;
  actual_hours?: number;
  created_at: string;
  loaded_by_program?: string;
}

// ---------------------------------------------------------------------------
// 6.10 fct_room_hours
// ---------------------------------------------------------------------------
export interface RoomHours {
  room_hour_id: string;
  tenant_id: string;
  room_id: string;
  location_id: string;
  date: string;
  scheduled_hours: number;
  available_hours?: number;
  blocked_hours?: number;
  created_at: string;
  loaded_by_program?: string;
}

// ---------------------------------------------------------------------------
// 7.1 ref_service_cost_rules
// ---------------------------------------------------------------------------
export interface ServiceCostRule {
  rule_id: string;
  tenant_id: string;
  service_id: string;
  direct_labor_basis?: number;
  expected_consumable_basis?: number;
  standard_other_direct_cost?: number;
  effective_start_date: string;
  effective_end_date: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 7.2 ref_overhead_allocation_rules
// ---------------------------------------------------------------------------
export interface OverheadAllocationRule {
  allocation_rule_id: string;
  tenant_id: string;
  expense_type: string;
  allocate_to: string;
  allocation_basis: string;
  driver_source: string;
  weight?: number;
  effective_start_date: string;
  effective_end_date: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 7.3 ref_pricing_rules
// ---------------------------------------------------------------------------
export interface PricingRule {
  pricing_rule_id: string;
  tenant_id: string;
  inventory_item_id?: string;
  service_id?: string;
  pricing_basis: string;
  list_price: number;
  promo_price?: number;
  membership_price?: number;
  effective_start_date: string;
  effective_end_date: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 7.4 ref_provider_pay_rules
// ---------------------------------------------------------------------------
export interface ProviderPayRule {
  pay_rule_id: string;
  tenant_id: string;
  provider_id: string;
  compensation_model: import('./entities.js').CompensationModel;
  variable_comp_formula: string;
  effective_start_date: string;
  effective_end_date: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 9.3 audit_extraction_runs
// ---------------------------------------------------------------------------
export interface ExtractionRun {
  extraction_run_id: string;
  tenant_id: string;
  center_id?: string;
  entity_type: string;
  extraction_start: string;
  extraction_end?: string;
  status: import('./entities.js').ExtractionStatus;
  records_fetched?: number;
  records_loaded?: number;
  error_message?: string;
  source_file_path?: string;
  checksum_sha256?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 9.4 audit_program_runs
// ---------------------------------------------------------------------------
export interface ProgramRun {
  program_run_id: number;
  tenant_id?: string;
  program_name: string;
  args?: string;
  run_start: string;
  run_end?: string;
  status: import('./entities.js').ProgramStatus;
  output_summary?: string;
  error_class?: import('./entities.js').ErrorClass;
  error_code?: string;
  error_message?: string;
  host?: string;
  code_version?: string;
  log_path?: string;
}

// ---------------------------------------------------------------------------
// 9.5 audit_data_changes
// ---------------------------------------------------------------------------
export interface DataChange {
  audit_id: number;
  tenant_id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  old_data?: string;
  new_data?: string;
  changed_by?: string;
  changed_at: string;
  change_reason?: string;
}
