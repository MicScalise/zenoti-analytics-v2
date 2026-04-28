-- =============================================================================
-- 005_rls_policies.sql — Row-Level Security for all tenant-scoped tables
-- Implements: TASK-006
-- Source: DD-31 §5, §6, §7 (RLS policies per table)
-- =============================================================================

-- =============================================================================
-- Database roles
-- =============================================================================

-- zenoti_app: application role, cannot bypass RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zenoti_app') THEN
    CREATE ROLE zenoti_app NOBYPASSRLS LOGIN;
  END IF;
END $$;

-- zenoti_admin: admin role, can bypass RLS for cross-tenant operations
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zenoti_admin') THEN
    CREATE ROLE zenoti_admin BYPASSRLS LOGIN;
  END IF;
END $$;

-- =============================================================================
-- Dimension tables — Enable RLS + tenant isolation
-- =============================================================================

-- dim_patients
ALTER TABLE dim_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_patients FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_patients ON dim_patients
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_providers
ALTER TABLE dim_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_providers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_providers ON dim_providers
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_services
ALTER TABLE dim_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_services ON dim_services
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_categories
ALTER TABLE dim_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_categories ON dim_categories
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_locations
ALTER TABLE dim_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_locations ON dim_locations
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_rooms
ALTER TABLE dim_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_rooms FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_rooms ON dim_rooms
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_inventory_items
ALTER TABLE dim_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_inventory_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_inventory_items ON dim_inventory_items
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_inventory_lots
ALTER TABLE dim_inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_inventory_lots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_inventory_lots ON dim_inventory_lots
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_acquisition_sources
ALTER TABLE dim_acquisition_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_acquisition_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_acquisition_sources ON dim_acquisition_sources
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- dim_membership_types
ALTER TABLE dim_membership_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_membership_types FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dim_membership_types ON dim_membership_types
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- =============================================================================
-- Fact tables — Enable RLS + tenant isolation
-- =============================================================================

-- fct_visits
ALTER TABLE fct_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_visits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_visits ON fct_visits
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_visit_services
ALTER TABLE fct_visit_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_visit_services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_visit_services ON fct_visit_services
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_payments
ALTER TABLE fct_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_payments ON fct_payments
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_package_redemptions
ALTER TABLE fct_package_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_package_redemptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_package_redemptions ON fct_package_redemptions
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_membership_billing
ALTER TABLE fct_membership_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_membership_billing FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_membership_billing ON fct_membership_billing
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_inventory_usage
ALTER TABLE fct_inventory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_inventory_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_inventory_usage ON fct_inventory_usage
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_revenue_events
ALTER TABLE fct_revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_revenue_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_revenue_events ON fct_revenue_events
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_cost_events
ALTER TABLE fct_cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_cost_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_cost_events ON fct_cost_events
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_provider_hours
ALTER TABLE fct_provider_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_provider_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_provider_hours ON fct_provider_hours
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- fct_room_hours
ALTER TABLE fct_room_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE fct_room_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fct_room_hours ON fct_room_hours
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- =============================================================================
-- Reference tables — Enable RLS + tenant isolation
-- =============================================================================

-- ref_service_cost_rules
ALTER TABLE ref_service_cost_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_service_cost_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ref_service_cost_rules ON ref_service_cost_rules
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ref_overhead_allocation_rules
ALTER TABLE ref_overhead_allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_overhead_allocation_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ref_overhead_allocation_rules ON ref_overhead_allocation_rules
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ref_pricing_rules
ALTER TABLE ref_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_pricing_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ref_pricing_rules ON ref_pricing_rules
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ref_provider_pay_rules
ALTER TABLE ref_provider_pay_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_provider_pay_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ref_provider_pay_rules ON ref_provider_pay_rules
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- =============================================================================
-- Config / system tables — Enable RLS + tenant isolation
-- =============================================================================

-- config_users
ALTER TABLE config_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_config_users ON config_users
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- =============================================================================
-- Tables WITHOUT RLS (by design):
-- - config_tenants: defines tenants; PK is tenant_id, not filterable
-- - dim_dates: shared dimension, no tenant_id column
-- =============================================================================
