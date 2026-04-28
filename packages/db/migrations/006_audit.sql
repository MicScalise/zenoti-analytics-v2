-- =============================================================================
-- 006_audit.sql — Audit schema, tables, trigger function, and per-table triggers
-- Implements: TASK-007
-- Source: DD-31 §9.3 (audit_extraction_runs), §9.4 (audit_program_runs),
--         §9.5 (audit_data_changes)
-- =============================================================================

-- =============================================================================
-- Create audit schema
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS audit;

-- =============================================================================
-- 9.3 audit_extraction_runs
-- =============================================================================

CREATE TABLE audit.audit_extraction_runs (
  extraction_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  center_id UUID NULL REFERENCES dim_locations(location_id),
  entity_type TEXT NOT NULL,
  extraction_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  extraction_end TIMESTAMPTZ NULL,
  status extraction_status NOT NULL DEFAULT 'running',
  records_fetched INTEGER NULL,
  records_loaded INTEGER NULL,
  error_message TEXT NULL,
  source_file_path TEXT NULL,
  checksum_sha256 TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ck_audit_extraction_runs_checksum
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_audit_extraction_runs_status_fields
    CHECK (
      (status = 'running' AND extraction_end IS NULL) OR
      (status IN ('completed','failed','skipped') AND extraction_end IS NOT NULL) OR
      (status = 'skipped' AND records_fetched IS NULL)
    )
);

CREATE INDEX idx_audit_extraction_runs_tenant_entity
  ON audit.audit_extraction_runs(tenant_id, entity_type, extraction_start DESC);

-- =============================================================================
-- 9.4 audit_program_runs
-- =============================================================================

CREATE TABLE audit.audit_program_runs (
  program_run_id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NULL,
  program_name TEXT NOT NULL,
  args JSONB NULL,
  run_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  run_end TIMESTAMPTZ NULL,
  status program_status NOT NULL DEFAULT 'running',
  output_summary TEXT NULL,
  error_class error_class NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  host TEXT NULL,
  code_version TEXT NULL,
  log_path TEXT NULL,

  CONSTRAINT ck_audit_program_runs_end_time
    CHECK (
      (status = 'running' AND run_end IS NULL) OR
      (status IN ('completed','failed','blocked') AND run_end IS NOT NULL)
    )
);

CREATE INDEX idx_audit_program_runs_tenant_program
  ON audit.audit_program_runs(tenant_id, program_name, run_start DESC);

CREATE INDEX idx_audit_program_runs_error_class
  ON audit.audit_program_runs(error_class)
  WHERE error_class IS NOT NULL;

-- =============================================================================
-- 9.5 audit_data_changes
-- =============================================================================

CREATE TABLE audit.audit_data_changes (
  audit_id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  record_id TEXT NOT NULL,
  old_data JSONB NULL,
  new_data JSONB NULL,
  changed_by UUID NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  change_reason TEXT NULL
);

CREATE INDEX idx_audit_data_changes_tenant_table
  ON audit.audit_data_changes(tenant_id, table_name, changed_at DESC);

-- =============================================================================
-- audit.log_change() — Generic audit trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER AS $$
DECLARE
  p_table_name TEXT := TG_ARGV[0];
  v_tenant_id UUID;
  v_record_id TEXT;
  v_pk_col TEXT;
  v_old JSONB;
  v_new JSONB;
  v_operation TEXT;
BEGIN
  -- Determine operation type
  v_operation := TG_OP;

  -- Extract tenant_id from NEW or OLD row
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_tenant_id := NEW.tenant_id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    -- UPDATE
    v_tenant_id := NEW.tenant_id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  -- Extract record_id: look up the actual PK column from pg_catalog
  -- BUG 5 FIX: config_tenants PK is tenant_id (not id, not config_tenants_id).
  -- All tables use descriptive PK names, so we must query the catalog.
  SELECT a.attname INTO v_pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = TG_RELID AND i.indisprimary
  LIMIT 1;

  IF v_pk_col IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      v_record_id := (to_jsonb(OLD) ->> v_pk_col);
    ELSE
      v_record_id := (to_jsonb(NEW) ->> v_pk_col);
    END IF;
  END IF;

  -- Strip surrounding quotes from JSON text
  IF v_record_id IS NOT NULL AND v_record_id LIKE '"%' THEN
    v_record_id := BTRIM(v_record_id, '"');
  END IF;

  -- Fallback for tables without tenant_id (e.g., dim_dates)
  IF v_tenant_id IS NULL THEN
    v_tenant_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  INSERT INTO audit.audit_data_changes (
    tenant_id, table_name, operation, record_id,
    old_data, new_data, changed_by, changed_at
  ) VALUES (
    v_tenant_id, p_table_name, v_operation, v_record_id,
    v_old, v_new,
    current_setting('app.user_id', true)::UUID,
    clock_timestamp()
  );

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Attach audit triggers to all business tables
-- Each trigger passes the table name to audit.log_change()
-- =============================================================================

-- Dimension tables
CREATE TRIGGER trg_dim_patients_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_patients
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_patients');

CREATE TRIGGER trg_dim_providers_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_providers
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_providers');

CREATE TRIGGER trg_dim_services_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_services
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_services');

CREATE TRIGGER trg_dim_categories_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_categories
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_categories');

CREATE TRIGGER trg_dim_locations_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_locations
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_locations');

CREATE TRIGGER trg_dim_rooms_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_rooms
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_rooms');

CREATE TRIGGER trg_dim_inventory_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_inventory_items
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_inventory_items');

CREATE TRIGGER trg_dim_inventory_lots_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_inventory_lots
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_inventory_lots');

CREATE TRIGGER trg_dim_acquisition_sources_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_acquisition_sources
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_acquisition_sources');

CREATE TRIGGER trg_dim_membership_types_audit
  AFTER INSERT OR UPDATE OR DELETE ON dim_membership_types
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('dim_membership_types');

-- Fact tables
CREATE TRIGGER trg_fct_visits_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_visits
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_visits');

CREATE TRIGGER trg_fct_visit_services_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_visit_services
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_visit_services');

CREATE TRIGGER trg_fct_payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_payments
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_payments');

CREATE TRIGGER trg_fct_package_redemptions_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_package_redemptions
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_package_redemptions');

CREATE TRIGGER trg_fct_membership_billing_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_membership_billing
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_membership_billing');

CREATE TRIGGER trg_fct_inventory_usage_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_inventory_usage
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_inventory_usage');

CREATE TRIGGER trg_fct_revenue_events_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_revenue_events
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_revenue_events');

CREATE TRIGGER trg_fct_cost_events_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_cost_events
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_cost_events');

CREATE TRIGGER trg_fct_provider_hours_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_provider_hours
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_provider_hours');

CREATE TRIGGER trg_fct_room_hours_audit
  AFTER INSERT OR UPDATE OR DELETE ON fct_room_hours
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('fct_room_hours');

-- Reference tables
CREATE TRIGGER trg_ref_service_cost_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON ref_service_cost_rules
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('ref_service_cost_rules');

CREATE TRIGGER trg_ref_overhead_allocation_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON ref_overhead_allocation_rules
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('ref_overhead_allocation_rules');

CREATE TRIGGER trg_ref_pricing_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON ref_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('ref_pricing_rules');

CREATE TRIGGER trg_ref_provider_pay_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON ref_provider_pay_rules
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('ref_provider_pay_rules');

-- Config tables
CREATE TRIGGER trg_config_users_audit
  AFTER INSERT OR UPDATE OR DELETE ON config_users
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('config_users');

CREATE TRIGGER trg_config_tenants_audit
  AFTER INSERT OR UPDATE OR DELETE ON config_tenants
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('config_tenants');
