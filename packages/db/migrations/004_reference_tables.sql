-- =============================================================================
-- 004_reference_tables.sql — Reference/rule tables with effective dating
-- Implements: TASK-005
-- Source: DD-31 §7 (Reference Tables)
-- =============================================================================

-- =============================================================================
-- 7.1 ref_service_cost_rules
-- =============================================================================

CREATE TABLE ref_service_cost_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  service_id UUID NOT NULL REFERENCES dim_services(service_id),
  direct_labor_basis NUMERIC(5,4) NULL CHECK (direct_labor_basis BETWEEN 0 AND 1),
  expected_consumable_basis NUMERIC(5,4) NULL CHECK (expected_consumable_basis BETWEEN 0 AND 1),
  standard_other_direct_cost NUMERIC(10,2) NULL CHECK (standard_other_direct_cost >= 0),

  effective_start_date DATE NOT NULL,
  effective_end_date DATE NOT NULL,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_ref_service_cost_rules_effective_dates
    CHECK (effective_end_date > effective_start_date)
);

CREATE INDEX idx_ref_service_cost_rules_service_effective
  ON ref_service_cost_rules(tenant_id, service_id, effective_start_date, effective_end_date);

-- =============================================================================
-- 7.2 ref_overhead_allocation_rules
-- =============================================================================

CREATE TABLE ref_overhead_allocation_rules (
  allocation_rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  expense_type TEXT NOT NULL,
  allocate_to TEXT NOT NULL,
  allocation_basis TEXT NOT NULL,
  driver_source TEXT NOT NULL,
  weight NUMERIC(5,4) NULL CHECK (weight BETWEEN 0 AND 1),

  effective_start_date DATE NOT NULL,
  effective_end_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_ref_overhead_allocation_rules_effective_dates
    CHECK (effective_end_date > effective_start_date)
);

CREATE INDEX idx_ref_overhead_allocation_rules_effective
  ON ref_overhead_allocation_rules(tenant_id, expense_type, effective_start_date, effective_end_date);

-- =============================================================================
-- 7.3 ref_pricing_rules
-- =============================================================================

CREATE TABLE ref_pricing_rules (
  pricing_rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  inventory_item_id UUID NULL REFERENCES dim_inventory_items(item_id),
  service_id UUID NULL REFERENCES dim_services(service_id),
  pricing_basis TEXT NOT NULL,
  list_price NUMERIC(10,2) NOT NULL CHECK (list_price >= 0),
  promo_price NUMERIC(10,2) NULL CHECK (promo_price >= 0),
  membership_price NUMERIC(10,2) NULL CHECK (membership_price >= 0),

  effective_start_date DATE NOT NULL,
  effective_end_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_ref_pricing_rules_exactly_one_target
    CHECK (
      (CASE WHEN inventory_item_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN service_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    ),
  CONSTRAINT ck_ref_pricing_rules_effective_dates
    CHECK (effective_end_date > effective_start_date)
);

CREATE INDEX idx_ref_pricing_rules_item_effective
  ON ref_pricing_rules(tenant_id, inventory_item_id, effective_start_date, effective_end_date);
CREATE INDEX idx_ref_pricing_rules_service_effective
  ON ref_pricing_rules(tenant_id, service_id, effective_start_date, effective_end_date);

-- =============================================================================
-- 7.4 ref_provider_pay_rules
-- =============================================================================

CREATE TABLE ref_provider_pay_rules (
  pay_rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  provider_id UUID NOT NULL REFERENCES dim_providers(provider_id),
  compensation_model compensation_model NOT NULL,
  variable_comp_formula TEXT NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_ref_provider_pay_rules_effective_dates
    CHECK (effective_end_date > effective_start_date)
);

CREATE INDEX idx_ref_provider_pay_rules_provider_effective
  ON ref_provider_pay_rules(tenant_id, provider_id, effective_start_date, effective_end_date);
