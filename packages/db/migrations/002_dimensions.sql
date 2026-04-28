-- =============================================================================
-- 002_dimensions.sql — All 11 dimension tables
-- Implements: TASK-003
-- Source: DD-31 §5 (Dimension Tables)
-- =============================================================================

-- =============================================================================
-- 5.5 dim_locations (must be created BEFORE dim_patients FK reference)
-- =============================================================================

CREATE TABLE dim_locations (
  location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NULL,
  loaded_by_program TEXT NULL,
  loaded_by_version TEXT NULL,
  source TEXT NULL,
  source_id TEXT NULL,

  CONSTRAINT ck_dim_locations_timezone_not_null
    CHECK (timezone IS NOT NULL)
);

CREATE UNIQUE INDEX uq_dim_locations_zenoti
  ON dim_locations(tenant_id, zenoti_location_id);

-- =============================================================================
-- 5.10 dim_acquisition_sources (must be created BEFORE dim_patients FK reference)
-- =============================================================================

CREATE TABLE dim_acquisition_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  source_name TEXT NOT NULL,
  source_category TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_dim_acquisition_sources_name
  ON dim_acquisition_sources(tenant_id, source_name);

-- =============================================================================
-- 5.4 dim_categories
-- =============================================================================

CREATE TABLE dim_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  category_name TEXT NOT NULL,
  parent_category_id UUID NULL REFERENCES dim_categories(category_id),
  is_reportable BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NULL,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT uq_dim_categories_name UNIQUE(tenant_id, category_name)
);

CREATE INDEX idx_dim_categories_parent
  ON dim_categories(parent_category_id);

-- =============================================================================
-- 5.2 dim_providers
-- =============================================================================

CREATE TABLE dim_providers (
  provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_employee_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  role provider_role NOT NULL,
  compensation_model compensation_model,
  base_rate NUMERIC(10,2) NULL,
  commission_rate NUMERIC(5,4) NULL,
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),
  is_active BOOLEAN NOT NULL DEFAULT true,

  effective_start DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_end DATE NOT NULL DEFAULT '2100-12-31'::DATE,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NULL,
  loaded_by_program TEXT NULL,
  loaded_by_version TEXT NULL,
  source TEXT NULL,
  source_id TEXT NULL,

  -- Check constraints
  CONSTRAINT ck_dim_providers_compensation_model
    CHECK (
      (compensation_model = 'flat' AND base_rate IS NOT NULL AND commission_rate IS NULL) OR
      (compensation_model = 'percentage' AND commission_rate IS NOT NULL AND base_rate IS NULL) OR
      (compensation_model = 'tiered' AND base_rate IS NULL AND commission_rate IS NULL) OR
      (compensation_model IS NULL AND base_rate IS NULL AND commission_rate IS NULL)
    ),
  CONSTRAINT ck_dim_providers_commission_rate
    CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1)),
  CONSTRAINT ck_dim_providers_effective_dates
    CHECK (effective_end > effective_start)
);

CREATE UNIQUE INDEX uq_dim_providers_zenoti
  ON dim_providers(tenant_id, zenoti_employee_id)
  WHERE effective_end = '2100-12-31'::DATE;

CREATE INDEX idx_dim_providers_role
  ON dim_providers(role);

CREATE INDEX idx_dim_providers_location
  ON dim_providers(location_id);

-- =============================================================================
-- 5.3 dim_services
-- =============================================================================

CREATE TABLE dim_services (
  service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES dim_categories(category_id),
  standard_duration_minutes INTEGER NULL CHECK (standard_duration_minutes >= 0),
  list_price NUMERIC(10,2) NULL CHECK (list_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,

  effective_start DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_end DATE NOT NULL DEFAULT '2100-12-31'::DATE,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NULL,
  loaded_by_program TEXT NULL,
  loaded_by_version TEXT NULL,
  source TEXT NULL,
  source_id TEXT NULL,

  CONSTRAINT ck_dim_services_effective_dates
    CHECK (effective_end > effective_start)
);

CREATE UNIQUE INDEX uq_dim_services_zenoti
  ON dim_services(tenant_id, zenoti_service_id)
  WHERE effective_end = '2100-12-31'::DATE;

CREATE INDEX idx_dim_services_category
  ON dim_services(category_id);

-- =============================================================================
-- 5.6 dim_rooms
-- =============================================================================

CREATE TABLE dim_rooms (
  room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_room_id TEXT NOT NULL,
  room_name TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),
  room_type room_type,
  capacity INTEGER NULL CHECK (capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NULL,
  loaded_by_program TEXT NULL,
  loaded_by_version TEXT NULL,
  source TEXT NULL,
  source_id TEXT NULL
);

CREATE UNIQUE INDEX uq_dim_rooms_zenoti
  ON dim_rooms(tenant_id, zenoti_room_id);

CREATE INDEX idx_dim_rooms_location
  ON dim_rooms(location_id);

-- =============================================================================
-- 5.7 dim_dates (shared dimension, no tenant_id)
-- =============================================================================

CREATE TABLE dim_dates (
  date DATE PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  day_name TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  month_name TEXT NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year INTEGER NOT NULL,
  year_month TEXT NOT NULL,
  year_quarter TEXT NOT NULL,
  is_weekend BOOLEAN NOT NULL,
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  holiday_name TEXT NULL,
  pay_period_start DATE NULL,
  pay_period_end DATE NULL,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- No RLS on shared dimension

-- =============================================================================
-- 5.8 dim_inventory_items
-- =============================================================================

CREATE TABLE dim_inventory_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  zenoti_product_id TEXT NOT NULL,
  sku TEXT,
  product_name TEXT NOT NULL,
  manufacturer TEXT,
  brand_family TEXT,
  product_type product_type NOT NULL,
  product_subtype TEXT,
  unit_of_measure TEXT NOT NULL,
  units_per_package INTEGER NULL CHECK (units_per_package > 0),
  default_cost NUMERIC(10,2) NULL CHECK (default_cost >= 0),
  default_price NUMERIC(10,2) NULL CHECK (default_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,

  effective_start DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_end DATE NOT NULL DEFAULT '2100-12-31'::DATE,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NULL,
  loaded_by_program TEXT NULL,
  loaded_by_version TEXT NULL,
  source TEXT NULL,
  source_id TEXT NULL,

  CONSTRAINT ck_dim_inventory_items_cost_price
    CHECK (default_cost IS NULL OR default_price IS NULL OR default_cost <= default_price)
);

CREATE UNIQUE INDEX uq_dim_inventory_items_zenoti
  ON dim_inventory_items(tenant_id, zenoti_product_id)
  WHERE effective_end = '2100-12-31'::DATE;

CREATE INDEX idx_dim_inventory_items_type
  ON dim_inventory_items(product_type);

CREATE INDEX idx_dim_inventory_items_brand
  ON dim_inventory_items(brand_family);

-- =============================================================================
-- 5.9 dim_inventory_lots
-- =============================================================================

CREATE TABLE dim_inventory_lots (
  lot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  item_id UUID NOT NULL REFERENCES dim_inventory_items(item_id),
  lot_number TEXT NOT NULL,
  received_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  vendor_id TEXT,
  received_quantity NUMERIC(10,2) NOT NULL CHECK (received_quantity > 0),
  received_unit_cost NUMERIC(10,4) NOT NULL CHECK (received_unit_cost >= 0),
  quantity_on_hand NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_expired BOOLEAN NOT NULL DEFAULT false,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NULL,
  loaded_by_program TEXT NULL,
  loaded_by_version TEXT NULL,
  source TEXT NULL,
  source_id TEXT NULL,

  -- Constraints
  CONSTRAINT ck_dim_inventory_lots_dates
    CHECK (expiration_date > received_date),
  CONSTRAINT ck_dim_inventory_lots_quantity
    CHECK (quantity_on_hand >= 0),
  CONSTRAINT ck_dim_inventory_lots_expired_quantity
    CHECK (is_expired = false OR quantity_on_hand = 0)
);

CREATE UNIQUE INDEX uq_dim_inventory_lots_lot_number
  ON dim_inventory_lots(tenant_id, lot_number);

CREATE INDEX idx_dim_inventory_lots_item
  ON dim_inventory_lots(item_id);

CREATE INDEX idx_dim_inventory_lots_expiration
  ON dim_inventory_lots(expiration_date);

CREATE INDEX idx_dim_inventory_lots_on_hand
  ON dim_inventory_lots(tenant_id, item_id)
  WHERE quantity_on_hand > 0 AND is_expired = false;

-- =============================================================================
-- 5.11 dim_membership_types
-- =============================================================================

CREATE TABLE dim_membership_types (
  membership_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  membership_name TEXT NOT NULL,
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('monthly','quarterly','annually')),
  recurring_fee NUMERIC(10,2) NOT NULL CHECK (recurring_fee >= 0),
  benefits_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_dim_membership_types_name
  ON dim_membership_types(tenant_id, membership_name);

-- =============================================================================
-- 5.1 dim_patients (created AFTER dim_locations and dim_acquisition_sources)
-- =============================================================================

CREATE TABLE dim_patients (
  -- Synthetic keys
  patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  -- Real-world identifiers
  zenoti_patient_id TEXT NOT NULL,

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,

  -- Foreign keys
  acquisition_source_id UUID NULL REFERENCES dim_acquisition_sources(source_id),
  location_id UUID NOT NULL REFERENCES dim_locations(location_id),

  -- Derived / snapshot
  first_visit_date DATE,
  last_visit_date DATE,
  patient_status patient_status NOT NULL DEFAULT 'active',

  -- Effective dating (SCD Type 2)
  effective_start DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_end DATE NOT NULL DEFAULT '2100-12-31'::DATE,

  -- Provenance columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NULL,
  loaded_by_program TEXT NULL,
  loaded_by_version TEXT NULL,
  source TEXT NULL,
  source_id TEXT NULL,

  -- Constraints
  CONSTRAINT ck_dim_patients_effective_dates
    CHECK (effective_end > effective_start),
  CONSTRAINT ck_dim_patients_status
    CHECK (patient_status IN ('active','churned','inactive'))
);

CREATE UNIQUE INDEX uq_dim_patients_zenoti
  ON dim_patients(tenant_id, zenoti_patient_id)
  WHERE effective_end = '2100-12-31'::DATE;

CREATE INDEX idx_dim_patients_acquisition
  ON dim_patients(acquisition_source_id);

CREATE INDEX idx_dim_patients_location
  ON dim_patients(location_id);

CREATE INDEX idx_dim_patients_status
  ON dim_patients(patient_status);

CREATE INDEX idx_dim_patients_first_visit
  ON dim_patients(first_visit_date)
  WHERE first_visit_date IS NOT NULL;
