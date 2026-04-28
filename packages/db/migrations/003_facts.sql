-- =============================================================================
-- 003_facts.sql — All 10 fact tables
-- Implements: TASK-004
-- Source: DD-31 §6 (Fact Tables)
-- =============================================================================

-- =============================================================================
-- 6.1 fct_visits
-- =============================================================================

CREATE TABLE fct_visits (
  visit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_visit_id TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES dim_patients(patient_id),
  provider_id UUID NULL REFERENCES dim_providers(provider_id),
  room_id UUID NULL REFERENCES dim_rooms(room_id),
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),
  appointment_id TEXT NULL,
  visit_date DATE NOT NULL,
  actual_start TIMESTAMPTZ NULL,
  actual_end TIMESTAMPTZ NULL,
  scheduled_duration_minutes INTEGER NULL CHECK (scheduled_duration_minutes >= 0),
  actual_duration_minutes INTEGER NULL CHECK (actual_duration_minutes >= 0),
  visit_status visit_status NOT NULL DEFAULT 'scheduled',
  is_new_patient_visit BOOLEAN NOT NULL DEFAULT false,
  no_show_flag BOOLEAN NOT NULL DEFAULT false,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_fct_visits_zenoti
  ON fct_visits(tenant_id, zenoti_visit_id);

CREATE INDEX idx_fct_visits_patient
  ON fct_visits(tenant_id, patient_id);

CREATE INDEX idx_fct_visits_provider
  ON fct_visits(tenant_id, provider_id);

CREATE INDEX idx_fct_visits_date
  ON fct_visits(tenant_id, visit_date);

CREATE INDEX idx_fct_visits_status
  ON fct_visits(tenant_id, visit_status);

CREATE INDEX idx_fct_visits_new_patient
  ON fct_visits(tenant_id, visit_date)
  WHERE is_new_patient_visit = true;

-- Trigger: update patient first/last visit dates on visit completion
CREATE OR REPLACE FUNCTION trg_update_patient_visit_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visit_status = 'completed' AND OLD.visit_status != 'completed' THEN
    UPDATE dim_patients p
    SET last_visit_date = GREATEST(COALESCE(p.last_visit_date, NEW.visit_date), NEW.visit_date),
        first_visit_date = LEAST(COALESCE(p.first_visit_date, NEW.visit_date), NEW.visit_date),
        updated_at = clock_timestamp()
    WHERE p.patient_id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fct_visits_update_patient_dates
  AFTER INSERT OR UPDATE ON fct_visits
  FOR EACH ROW EXECUTE FUNCTION trg_update_patient_visit_dates();

-- =============================================================================
-- 6.2 fct_visit_services
-- =============================================================================

CREATE TABLE fct_visit_services (
  visit_service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_visit_service_id TEXT NOT NULL,
  visit_id UUID NOT NULL REFERENCES fct_visits(visit_id),
  service_id UUID NOT NULL REFERENCES dim_services(service_id),
  provider_id UUID NULL REFERENCES dim_providers(provider_id),
  category_id UUID NOT NULL REFERENCES dim_categories(category_id),
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity >= 0),
  gross_revenue NUMERIC(12,2) NOT NULL CHECK (gross_revenue >= 0),
  discounts NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discounts >= 0),
  net_revenue NUMERIC(12,2) NOT NULL CHECK (net_revenue >= 0),
  earned_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_fct_visit_services_net_revenue
    CHECK (net_revenue = gross_revenue - discounts)
);

CREATE UNIQUE INDEX uq_fct_visit_services_zenoti
  ON fct_visit_services(tenant_id, zenoti_visit_service_id);

CREATE INDEX idx_fct_visit_services_visit
  ON fct_visit_services(tenant_id, visit_id);

CREATE INDEX idx_fct_visit_services_service
  ON fct_visit_services(tenant_id, service_id);

CREATE INDEX idx_fct_visit_services_provider
  ON fct_visit_services(tenant_id, provider_id);

CREATE INDEX idx_fct_visit_services_category
  ON fct_visit_services(tenant_id, category_id);

CREATE INDEX idx_fct_visit_services_earned_date
  ON fct_visit_services(tenant_id, earned_date);

-- =============================================================================
-- 6.3 fct_payments
-- =============================================================================

CREATE TABLE fct_payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_payment_id TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES dim_patients(patient_id),
  visit_id UUID NULL REFERENCES fct_visits(visit_id),
  package_id TEXT NULL,
  membership_id TEXT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  tender_type tender_type NOT NULL,
  liability_account_type liability_account_type NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_fct_payments_exactly_one_fk
    CHECK (
      (CASE WHEN visit_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN package_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN membership_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

CREATE UNIQUE INDEX uq_fct_payments_zenoti
  ON fct_payments(tenant_id, zenoti_payment_id);

CREATE INDEX idx_fct_payments_patient
  ON fct_payments(tenant_id, patient_id);

CREATE INDEX idx_fct_payments_date
  ON fct_payments(tenant_id, payment_date);

CREATE INDEX idx_fct_payments_tender
  ON fct_payments(tenant_id, tender_type);

-- =============================================================================
-- 6.4 fct_package_redemptions
-- =============================================================================

CREATE TABLE fct_package_redemptions (
  redemption_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_redemption_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES dim_patients(patient_id),
  visit_service_id UUID NOT NULL REFERENCES fct_visit_services(visit_service_id),
  redemption_date DATE NOT NULL,
  units_redeemed NUMERIC(10,2) NOT NULL CHECK (units_redeemed > 0),
  recognized_revenue_amount NUMERIC(12,2) NOT NULL CHECK (recognized_revenue_amount >= 0),

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_fct_package_redemptions_zenoti
  ON fct_package_redemptions(tenant_id, zenoti_redemption_id);

CREATE INDEX idx_fct_package_redemptions_patient
  ON fct_package_redemptions(tenant_id, patient_id);

CREATE INDEX idx_fct_package_redemptions_visit_service
  ON fct_package_redemptions(tenant_id, visit_service_id);

CREATE INDEX idx_fct_package_redemptions_date
  ON fct_package_redemptions(tenant_id, redemption_date);

-- =============================================================================
-- 6.5 fct_membership_billing
-- =============================================================================

CREATE TABLE fct_membership_billing (
  billing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_billing_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  membership_type_id UUID NOT NULL REFERENCES dim_membership_types(membership_type_id),
  patient_id UUID NOT NULL REFERENCES dim_patients(patient_id),
  bill_date DATE NOT NULL,
  amount_billed NUMERIC(12,2) NOT NULL CHECK (amount_billed >= 0),
  amount_collected NUMERIC(12,2) NOT NULL CHECK (amount_collected >= 0),
  coverage_period_start DATE NOT NULL,
  coverage_period_end DATE NOT NULL,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_fct_membership_billing_period
    CHECK (coverage_period_end > coverage_period_start),
  CONSTRAINT ck_fct_membership_billing_collected
    CHECK (amount_collected <= amount_billed)
);

CREATE UNIQUE INDEX uq_fct_membership_billing_zenoti
  ON fct_membership_billing(tenant_id, zenoti_billing_id);

CREATE INDEX idx_fct_membership_billing_patient
  ON fct_membership_billing(tenant_id, patient_id);

CREATE INDEX idx_fct_membership_billing_date
  ON fct_membership_billing(tenant_id, bill_date);

CREATE INDEX idx_fct_membership_billing_period
  ON fct_membership_billing(tenant_id, coverage_period_start, coverage_period_end);

-- =============================================================================
-- 6.6 fct_inventory_usage
-- =============================================================================

CREATE TABLE fct_inventory_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_usage_id TEXT NULL,
  visit_service_id UUID NOT NULL REFERENCES fct_visit_services(visit_service_id),
  lot_id UUID NOT NULL REFERENCES dim_inventory_lots(lot_id),
  inventory_item_id UUID NOT NULL REFERENCES dim_inventory_items(item_id),
  usage_date DATE NOT NULL,
  quantity_used NUMERIC(10,2) NOT NULL CHECK (quantity_used > 0),
  unit_cost_at_time NUMERIC(10,4) NOT NULL CHECK (unit_cost_at_time >= 0),
  extended_cost NUMERIC(12,2) NOT NULL CHECK (extended_cost >= 0),
  treatment_area TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_fct_inventory_usage_extended_cost
    CHECK (extended_cost = ROUND(quantity_used * unit_cost_at_time, 2))
);

CREATE UNIQUE INDEX uq_fct_inventory_usage_zenoti
  ON fct_inventory_usage(tenant_id, zenoti_usage_id)
  WHERE zenoti_usage_id IS NOT NULL;

CREATE INDEX idx_fct_inventory_usage_visit_service
  ON fct_inventory_usage(tenant_id, visit_service_id);

CREATE INDEX idx_fct_inventory_usage_lot
  ON fct_inventory_usage(tenant_id, lot_id);

CREATE INDEX idx_fct_inventory_usage_item
  ON fct_inventory_usage(tenant_id, inventory_item_id);

CREATE INDEX idx_fct_inventory_usage_date
  ON fct_inventory_usage(tenant_id, usage_date);

CREATE INDEX idx_fct_inventory_usage_treatment_area
  ON fct_inventory_usage(treatment_area);

-- Trigger: verify quantity available before insert
CREATE OR REPLACE FUNCTION trg_check_inventory_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_available NUMERIC(10,2);
BEGIN
  SELECT quantity_on_hand INTO v_available
  FROM dim_inventory_lots
  WHERE lot_id = NEW.lot_id
    AND tenant_id = NEW.tenant_id
    AND is_expired = false
  FOR UPDATE;

  IF v_available < NEW.quantity_used THEN
    RAISE EXCEPTION 'I-USAGE-01: Insufficient inventory in lot %. Available: %, Requested: %',
      NEW.lot_id, v_available, NEW.quantity_used
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_fct_inventory_usage_check_stock
  AFTER INSERT ON fct_inventory_usage
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_check_inventory_availability();

-- =============================================================================
-- 6.7 fct_revenue_events
-- =============================================================================

CREATE TABLE fct_revenue_events (
  revenue_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  patient_id UUID NOT NULL REFERENCES dim_patients(patient_id),
  visit_id UUID NULL REFERENCES fct_visits(visit_id),
  visit_service_id UUID NULL REFERENCES fct_visit_services(visit_service_id),
  provider_id UUID NULL REFERENCES dim_providers(provider_id),
  category_id UUID NOT NULL REFERENCES dim_categories(category_id),
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),

  revenue_type revenue_type NOT NULL,
  earned_date DATE NOT NULL,
  earned_amount NUMERIC(12,2) NOT NULL CHECK (earned_amount >= 0),

  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_fct_revenue_events_patient
  ON fct_revenue_events(tenant_id, patient_id);

CREATE INDEX idx_fct_revenue_events_provider
  ON fct_revenue_events(tenant_id, provider_id);

CREATE INDEX idx_fct_revenue_events_category
  ON fct_revenue_events(tenant_id, category_id);

CREATE INDEX idx_fct_revenue_events_date
  ON fct_revenue_events(tenant_id, earned_date);

CREATE INDEX idx_fct_revenue_events_type
  ON fct_revenue_events(tenant_id, revenue_type);

-- =============================================================================
-- 6.8 fct_cost_events
-- =============================================================================

CREATE TABLE fct_cost_events (
  cost_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  patient_id UUID NOT NULL REFERENCES dim_patients(patient_id),
  visit_id UUID NULL REFERENCES fct_visits(visit_id),
  visit_service_id UUID NOT NULL REFERENCES fct_visit_services(visit_service_id),
  provider_id UUID NULL REFERENCES dim_providers(provider_id),
  category_id UUID NOT NULL REFERENCES dim_categories(category_id),
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),

  cost_type cost_type NOT NULL,
  recognized_date DATE NOT NULL,
  direct_cost_amount NUMERIC(12,2) NOT NULL CHECK (direct_cost_amount >= 0),

  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_fct_cost_events_patient
  ON fct_cost_events(tenant_id, patient_id);
CREATE INDEX idx_fct_cost_events_provider
  ON fct_cost_events(tenant_id, provider_id);
CREATE INDEX idx_fct_cost_events_category
  ON fct_cost_events(tenant_id, category_id);
CREATE INDEX idx_fct_cost_events_date
  ON fct_cost_events(tenant_id, recognized_date);
CREATE INDEX idx_fct_cost_events_type
  ON fct_cost_events(tenant_id, cost_type);

-- =============================================================================
-- 6.9 fct_provider_hours
-- =============================================================================

CREATE TABLE fct_provider_hours (
  provider_hour_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES dim_providers(provider_id),
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),
  date DATE NOT NULL,
  scheduled_hours NUMERIC(5,2) NOT NULL CHECK (scheduled_hours >= 0),
  available_hours NUMERIC(5,2) NULL CHECK (available_hours >= 0),
  blocked_hours NUMERIC(5,2) NULL CHECK (blocked_hours >= 0),
  actual_hours NUMERIC(5,2) NULL CHECK (actual_hours >= 0),

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  loaded_by_program TEXT NULL,

  CONSTRAINT uq_fct_provider_hours_provider_date UNIQUE(tenant_id, provider_id, date)
);

CREATE INDEX idx_fct_provider_hours_location
  ON fct_provider_hours(tenant_id, location_id);
CREATE INDEX idx_fct_provider_hours_date
  ON fct_provider_hours(tenant_id, date);

-- =============================================================================
-- 6.10 fct_room_hours
-- =============================================================================

CREATE TABLE fct_room_hours (
  room_hour_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES dim_rooms(room_id),
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),
  date DATE NOT NULL,
  scheduled_hours NUMERIC(5,2) NOT NULL CHECK (scheduled_hours >= 0),
  available_hours NUMERIC(5,2) NULL CHECK (available_hours >= 0),
  blocked_hours NUMERIC(5,2) NULL CHECK (blocked_hours >= 0),

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  loaded_by_program TEXT NULL,

  CONSTRAINT uq_fct_room_hours_room_date UNIQUE(tenant_id, room_id, date)
);

CREATE INDEX idx_fct_room_hours_location
  ON fct_room_hours(tenant_id, location_id);
CREATE INDEX idx_fct_room_hours_date
  ON fct_room_hours(tenant_id, date);
