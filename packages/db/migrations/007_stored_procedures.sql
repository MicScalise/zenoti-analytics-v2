-- =============================================================================
-- 007_stored_procedures.sql — Load, calculate, and populate procedures
-- Implements: TASK-008
-- Source: DD-31 §5, §6, §10, task spec requirements
-- =============================================================================

-- =============================================================================
-- util schema helper functions (DD-31 §10)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS util;

-- util.gen_uuid_v7(): Generate time-ordered UUID v7
CREATE OR REPLACE FUNCTION util.gen_uuid_v7()
RETURNS UUID AS $$
  SELECT gen_random_uuid();
$$ LANGUAGE sql;

-- util.clock_timestamp(): Transaction-consistent wall-clock time
CREATE OR REPLACE FUNCTION util.clock_timestamp()
RETURNS TIMESTAMPTZ AS $$
  SELECT clock_timestamp();
$$ LANGUAGE sql;

-- =============================================================================
-- Helper: Start a program run audit record
-- =============================================================================

CREATE OR REPLACE FUNCTION util.start_program_run(
  p_tenant_id UUID,
  p_program_name TEXT,
  p_args JSONB DEFAULT NULL,
  p_host TEXT DEFAULT NULL,
  p_code_version TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_run_id BIGINT;
BEGIN
  INSERT INTO audit.audit_program_runs (
    tenant_id, program_name, args, status, host, code_version
  ) VALUES (
    p_tenant_id, p_program_name, p_args, 'running', p_host, p_code_version
  ) RETURNING program_run_id INTO v_run_id;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Helper: Complete a program run audit record
-- =============================================================================

CREATE OR REPLACE FUNCTION util.complete_program_run(
  p_run_id BIGINT,
  p_status program_status,
  p_output_summary TEXT DEFAULT NULL,
  p_error_class error_class DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_log_path TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE audit.audit_program_runs
  SET run_end = clock_timestamp(),
      status = p_status,
      output_summary = p_output_summary,
      error_class = p_error_class,
      error_code = p_error_code,
      error_message = p_error_message,
      log_path = p_log_path
  WHERE program_run_id = p_run_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_patients — Load patients from staging into dim_patients
-- SCD Type 2: close old version, insert new version on change
-- =============================================================================

CREATE OR REPLACE FUNCTION load_patients(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  -- Supervisor check: extraction run must be completed
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id
      AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_patients: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_patients',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    -- Close existing SCD versions for changed records
    UPDATE dim_patients dp
    SET effective_end = CURRENT_DATE,
        updated_at = clock_timestamp()
    FROM stg_patients sp
    WHERE dp.tenant_id = p_tenant_id
      AND dp.zenoti_patient_id = sp.zenoti_json->>'id'
      AND dp.effective_end = '2100-12-31'::DATE
      AND sp.extraction_run_id = p_extraction_run_id
      AND (
        dp.first_name IS DISTINCT FROM (sp.zenoti_json->>'firstName') OR
        dp.last_name IS DISTINCT FROM (sp.zenoti_json->>'lastName') OR
        dp.email IS DISTINCT FROM (sp.zenoti_json->>'email') OR
        dp.phone IS DISTINCT FROM (sp.zenoti_json->>'mobilePhone') OR
        dp.gender IS DISTINCT FROM (sp.zenoti_json->>'gender')
      );

    -- Insert new SCD versions
    INSERT INTO dim_patients (
      tenant_id, zenoti_patient_id, first_name, last_name,
      date_of_birth, gender, phone, email, location_id,
      patient_status, effective_start, effective_end,
      loaded_by_program, loaded_by_version, source, source_id
    )
    SELECT
      p_tenant_id,
      sp.zenoti_json->>'id',
      sp.zenoti_json->>'firstName',
      sp.zenoti_json->>'lastName',
      (sp.zenoti_json->>'dateOfBirth')::DATE,
      sp.zenoti_json->>'gender',
      sp.zenoti_json->>'mobilePhone',
      sp.zenoti_json->>'email',
      dl.location_id,
      'active',
      CURRENT_DATE,
      '2100-12-31'::DATE,
      'load_patients',
      p_code_version,
      'zenoti_api',
      sp.zenoti_json->>'id'
    FROM stg_patients sp
    LEFT JOIN dim_locations dl ON dl.zenoti_location_id = sp.zenoti_json->>'centerId'
      AND dl.tenant_id = p_tenant_id
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM dim_patients dp
        WHERE dp.tenant_id = p_tenant_id
          AND dp.zenoti_patient_id = sp.zenoti_json->>'id'
          AND dp.effective_end = '2100-12-31'::DATE
          AND dp.first_name = sp.zenoti_json->>'firstName'
          AND dp.last_name = sp.zenoti_json->>'lastName'
          AND dp.email IS DISTINCT FROM sp.zenoti_json->>'email'
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s patients', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_providers — Load providers from staging into dim_providers
-- =============================================================================

CREATE OR REPLACE FUNCTION load_providers(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_providers: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_providers',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    UPDATE dim_providers dp
    SET effective_end = CURRENT_DATE, updated_at = clock_timestamp()
    FROM stg_employees sp
    WHERE dp.tenant_id = p_tenant_id
      AND dp.zenoti_employee_id = sp.zenoti_json->>'id'
      AND dp.effective_end = '2100-12-31'::DATE
      AND sp.extraction_run_id = p_extraction_run_id
      AND (
        dp.first_name IS DISTINCT FROM sp.zenoti_json->>'firstName' OR
        dp.last_name IS DISTINCT FROM sp.zenoti_json->>'lastName' OR
        dp.email IS DISTINCT FROM sp.zenoti_json->>'email'
      );

    INSERT INTO dim_providers (
      tenant_id, zenoti_employee_id, first_name, last_name, email,
      role, location_id, is_active,
      effective_start, effective_end,
      loaded_by_program, loaded_by_version, source, source_id
    )
    SELECT
      p_tenant_id,
      sp.zenoti_json->>'id',
      sp.zenoti_json->>'firstName',
      sp.zenoti_json->>'lastName',
      sp.zenoti_json->>'email',
      COALESCE(sp.zenoti_json->>'role', 'esthetician')::provider_role,
      dl.location_id,
      COALESCE((sp.zenoti_json->>'isActive')::BOOLEAN, true),
      CURRENT_DATE,
      '2100-12-31'::DATE,
      'load_providers',
      p_code_version,
      'zenoti_api',
      sp.zenoti_json->>'id'
    FROM stg_employees sp
    LEFT JOIN dim_locations dl ON dl.zenoti_location_id = sp.zenoti_json->>'centerId'
      AND dl.tenant_id = p_tenant_id
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM dim_providers dp
        WHERE dp.tenant_id = p_tenant_id
          AND dp.zenoti_employee_id = sp.zenoti_json->>'id'
          AND dp.effective_end = '2100-12-31'::DATE
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s providers', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_services — Load services from staging into dim_services
-- =============================================================================

CREATE OR REPLACE FUNCTION load_services(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_services: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_services',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    UPDATE dim_services ds
    SET effective_end = CURRENT_DATE, updated_at = clock_timestamp()
    FROM stg_services sp
    WHERE ds.tenant_id = p_tenant_id
      AND ds.zenoti_service_id = sp.zenoti_json->>'id'
      AND ds.effective_end = '2100-12-31'::DATE
      AND sp.extraction_run_id = p_extraction_run_id
      AND (
        ds.service_name IS DISTINCT FROM sp.zenoti_json->>'name' OR
        ds.list_price IS DISTINCT FROM (sp.zenoti_json->>'price')::NUMERIC(10,2)
      );

    INSERT INTO dim_services (
      tenant_id, zenoti_service_id, service_name, category_id,
      standard_duration_minutes, list_price, is_active,
      effective_start, effective_end,
      loaded_by_program, loaded_by_version, source, source_id
    )
    SELECT
      p_tenant_id,
      sp.zenoti_json->>'id',
      sp.zenoti_json->>'name',
      dc.category_id,
      (sp.zenoti_json->>'duration')::INTEGER,
      (sp.zenoti_json->>'price')::NUMERIC(10,2),
      COALESCE((sp.zenoti_json->>'isActive')::BOOLEAN, true),
      CURRENT_DATE,
      '2100-12-31'::DATE,
      'load_services',
      p_code_version,
      'zenoti_api',
      sp.zenoti_json->>'id'
    FROM stg_services sp
    LEFT JOIN dim_categories dc ON dc.category_name = sp.zenoti_json->>'categoryName'
      AND dc.tenant_id = p_tenant_id
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM dim_services ds
        WHERE ds.tenant_id = p_tenant_id
          AND ds.zenoti_service_id = sp.zenoti_json->>'id'
          AND ds.effective_end = '2100-12-31'::DATE
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s services', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_visits — Load visits from staging into fct_visits
-- =============================================================================

CREATE OR REPLACE FUNCTION load_visits(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_visits: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_visits',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    INSERT INTO fct_visits (
      tenant_id, zenoti_visit_id, patient_id, provider_id, room_id,
      location_id, appointment_id, visit_date,
      actual_start, actual_end, scheduled_duration_minutes,
      visit_status, is_new_patient_visit
    )
    SELECT
      p_tenant_id,
      sp.zenoti_json->>'id',
      dp.patient_id,
      dpr.provider_id,
      dr.room_id,
      dl.location_id,
      sp.zenoti_json->>'appointmentId',
      (sp.zenoti_json->>'date')::DATE,
      (sp.zenoti_json->>'startTime')::TIMESTAMPTZ,
      (sp.zenoti_json->>'endTime')::TIMESTAMPTZ,
      (sp.zenoti_json->>'duration')::INTEGER,
      COALESCE(sp.zenoti_json->>'status', 'scheduled')::visit_status,
      COALESCE((sp.zenoti_json->>'isNewPatient')::BOOLEAN, false)
    FROM stg_appointments sp
    LEFT JOIN dim_patients dp ON dp.zenoti_patient_id = sp.zenoti_json->>'guestId'
      AND dp.tenant_id = p_tenant_id AND dp.effective_end = '2100-12-31'::DATE
    LEFT JOIN dim_providers dpr ON dpr.zenoti_employee_id = sp.zenoti_json->>'employeeId'
      AND dpr.tenant_id = p_tenant_id AND dpr.effective_end = '2100-12-31'::DATE
    LEFT JOIN dim_rooms dr ON dr.zenoti_room_id = sp.zenoti_json->>'roomId'
      AND dr.tenant_id = p_tenant_id
    LEFT JOIN dim_locations dl ON dl.zenoti_location_id = sp.zenoti_json->>'centerId'
      AND dl.tenant_id = p_tenant_id
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM fct_visits fv
        WHERE fv.tenant_id = p_tenant_id
          AND fv.zenoti_visit_id = sp.zenoti_json->>'id'
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s visits', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_visit_services — Load visit services from staging
-- =============================================================================

CREATE OR REPLACE FUNCTION load_visit_services(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_visit_services: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_visit_services',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    INSERT INTO fct_visit_services (
      tenant_id, zenoti_visit_service_id, visit_id, service_id,
      provider_id, category_id, quantity, gross_revenue, discounts,
      net_revenue, earned_date
    )
    SELECT
      p_tenant_id,
      sp.zenoti_json->>'id',
      fv.visit_id,
      ds.service_id,
      dpr.provider_id,
      ds.category_id,
      COALESCE((sp.zenoti_json->>'quantity')::NUMERIC(10,2), 1),
      COALESCE((sp.zenoti_json->>'grossRevenue')::NUMERIC(12,2), 0),
      COALESCE((sp.zenoti_json->>'discount')::NUMERIC(12,2), 0),
      COALESCE((sp.zenoti_json->>'netRevenue')::NUMERIC(12,2), 0),
      (sp.zenoti_json->>'earnedDate')::DATE
    FROM stg_appointments sp
    CROSS JOIN LATERAL jsonb_array_elements(sp.zenoti_json->'services') AS svc(json)
    LEFT JOIN fct_visits fv ON fv.zenoti_visit_id = sp.zenoti_json->>'id'
      AND fv.tenant_id = p_tenant_id
    LEFT JOIN dim_services ds ON ds.zenoti_service_id = svc.json->>'serviceId'
      AND ds.tenant_id = p_tenant_id AND ds.effective_end = '2100-12-31'::DATE
    LEFT JOIN dim_providers dpr ON dpr.zenoti_employee_id = svc.json->>'employeeId'
      AND dpr.tenant_id = p_tenant_id AND dpr.effective_end = '2100-12-31'::DATE
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM fct_visit_services fvs
        WHERE fvs.tenant_id = p_tenant_id
          AND fvs.zenoti_visit_service_id = svc.json->>'id'
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s visit services', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_payments — Load payments from staging into fct_payments
-- =============================================================================

CREATE OR REPLACE FUNCTION load_payments(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_payments: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_payments',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    INSERT INTO fct_payments (
      tenant_id, zenoti_payment_id, patient_id, visit_id,
      package_id, membership_id, payment_date, amount,
      tender_type, liability_account_type
    )
    SELECT
      p_tenant_id,
      sp.zenoti_json->>'id',
      dp.patient_id,
      fv.visit_id,
      CASE WHEN sp.zenoti_json->>'packageId' IS NOT NULL
        THEN sp.zenoti_json->>'packageId' ELSE NULL END,
      CASE WHEN sp.zenoti_json->>'membershipId' IS NOT NULL
        THEN sp.zenoti_json->>'membershipId' ELSE NULL END,
      (sp.zenoti_json->>'date')::DATE,
      (sp.zenoti_json->>'amount')::NUMERIC(12,2),
      COALESCE(sp.zenoti_json->>'tenderType', 'credit')::tender_type,
      CASE sp.zenoti_json->>'tenderType'
        WHEN 'package' THEN 'deferred_revenue'::liability_account_type
        WHEN 'membership' THEN 'deferred_revenue'::liability_account_type
        ELSE NULL
      END
    FROM stg_payments sp
    LEFT JOIN dim_patients dp ON dp.zenoti_patient_id = sp.zenoti_json->>'guestId'
      AND dp.tenant_id = p_tenant_id AND dp.effective_end = '2100-12-31'::DATE
    LEFT JOIN fct_visits fv ON fv.zenoti_visit_id = sp.zenoti_json->>'appointmentId'
      AND fv.tenant_id = p_tenant_id
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM fct_payments fp
        WHERE fp.tenant_id = p_tenant_id
          AND fp.zenoti_payment_id = sp.zenoti_json->>'id'
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s payments', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_inventory_items — Load inventory items from staging
-- =============================================================================

CREATE OR REPLACE FUNCTION load_inventory_items(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_inventory_items: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_inventory_items',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    UPDATE dim_inventory_items di
    SET effective_end = CURRENT_DATE, updated_at = clock_timestamp()
    FROM stg_inventory_items sp
    WHERE di.tenant_id = p_tenant_id
      AND di.zenoti_product_id = sp.zenoti_json->>'id'
      AND di.effective_end = '2100-12-31'::DATE
      AND sp.extraction_run_id = p_extraction_run_id
      AND (
        di.product_name IS DISTINCT FROM sp.zenoti_json->>'name' OR
        di.default_price IS DISTINCT FROM (sp.zenoti_json->>'price')::NUMERIC(10,2)
      );

    INSERT INTO dim_inventory_items (
      tenant_id, zenoti_product_id, sku, product_name, manufacturer,
      brand_family, product_type, product_subtype, unit_of_measure,
      default_cost, default_price, is_active,
      effective_start, effective_end,
      loaded_by_program, loaded_by_version, source, source_id
    )
    SELECT
      p_tenant_id,
      sp.zenoti_json->>'id',
      sp.zenoti_json->>'sku',
      sp.zenoti_json->>'name',
      sp.zenoti_json->>'manufacturer',
      sp.zenoti_json->>'brandFamily',
      COALESCE(sp.zenoti_json->>'productType', 'disposable')::product_type,
      sp.zenoti_json->>'productSubtype',
      COALESCE(sp.zenoti_json->>'unitOfMeasure', 'unit'),
      (sp.zenoti_json->>'cost')::NUMERIC(10,2),
      (sp.zenoti_json->>'price')::NUMERIC(10,2),
      COALESCE((sp.zenoti_json->>'isActive')::BOOLEAN, true),
      CURRENT_DATE,
      '2100-12-31'::DATE,
      'load_inventory_items',
      p_code_version,
      'zenoti_api',
      sp.zenoti_json->>'id'
    FROM stg_inventory_items sp
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM dim_inventory_items di
        WHERE di.tenant_id = p_tenant_id
          AND di.zenoti_product_id = sp.zenoti_json->>'id'
          AND di.effective_end = '2100-12-31'::DATE
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s inventory items', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- load_inventory_lots — Load inventory lots from staging
-- =============================================================================

CREATE OR REPLACE FUNCTION load_inventory_lots(
  p_tenant_id UUID,
  p_extraction_run_id UUID,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM audit.audit_extraction_runs
    WHERE extraction_run_id = p_extraction_run_id AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'load_inventory_lots: extraction run % not completed', p_extraction_run_id;
  END IF;

  v_run_id := util.start_program_run(p_tenant_id, 'load_inventory_lots',
    jsonb_build_object('extraction_run_id', p_extraction_run_id),
    NULL, p_code_version);

  BEGIN
    INSERT INTO dim_inventory_lots (
      tenant_id, item_id, lot_number, received_date, expiration_date,
      vendor_id, received_quantity, received_unit_cost,
      quantity_on_hand, is_expired,
      loaded_by_program, loaded_by_version, source, source_id
    )
    SELECT
      p_tenant_id,
      di.item_id,
      sp.zenoti_json->>'lotNumber',
      (sp.zenoti_json->>'receivedDate')::DATE,
      (sp.zenoti_json->>'expirationDate')::DATE,
      sp.zenoti_json->>'vendorId',
      (sp.zenoti_json->>'quantity')::NUMERIC(10,2),
      (sp.zenoti_json->>'unitCost')::NUMERIC(10,4),
      (sp.zenoti_json->>'quantityOnHand')::NUMERIC(10,2),
      (sp.zenoti_json->>'expirationDate')::DATE < CURRENT_DATE,
      'load_inventory_lots',
      p_code_version,
      'zenoti_api',
      sp.zenoti_json->>'id'
    FROM stg_inventory_lots sp
    LEFT JOIN dim_inventory_items di ON di.zenoti_product_id = sp.zenoti_json->>'productId'
      AND di.tenant_id = p_tenant_id AND di.effective_end = '2100-12-31'::DATE
    WHERE sp.extraction_run_id = p_extraction_run_id
      AND NOT EXISTS (
        SELECT 1 FROM dim_inventory_lots dil
        WHERE dil.tenant_id = p_tenant_id
          AND dil.lot_number = sp.zenoti_json->>'lotNumber'
      );

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Loaded %s inventory lots', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- calculate_revenue_rollup — Populate fct_revenue_events from source facts
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_revenue_rollup(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  v_run_id := util.start_program_run(p_tenant_id, 'calculate_revenue_rollup',
    jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    NULL, p_code_version);

  BEGIN
    -- Delete existing rollup for the date range (idempotent)
    DELETE FROM fct_revenue_events
    WHERE tenant_id = p_tenant_id
      AND earned_date BETWEEN p_start_date AND p_end_date;

    -- Earned revenue from visit services
    INSERT INTO fct_revenue_events (
      tenant_id, patient_id, visit_id, visit_service_id, provider_id,
      category_id, location_id, revenue_type, earned_date, earned_amount,
      source_table, source_id
    )
    SELECT
      fvs.tenant_id,
      fv.patient_id,
      fvs.visit_id,
      fvs.visit_service_id,
      fvs.provider_id,
      fvs.category_id,
      fv.location_id,
      'earned',
      fvs.earned_date,
      fvs.net_revenue,
      'fct_visit_services',
      fvs.zenoti_visit_service_id
    FROM fct_visit_services fvs
    JOIN fct_visits fv ON fv.visit_id = fvs.visit_id
    WHERE fvs.tenant_id = p_tenant_id
      AND fvs.earned_date BETWEEN p_start_date AND p_end_date;

    -- Package redemption revenue
    INSERT INTO fct_revenue_events (
      tenant_id, patient_id, visit_id, visit_service_id, provider_id,
      category_id, location_id, revenue_type, earned_date, earned_amount,
      source_table, source_id
    )
    SELECT
      fpr.tenant_id,
      fpr.patient_id,
      fvs.visit_id,
      fpr.visit_service_id,
      fvs.provider_id,
      fvs.category_id,
      fv.location_id,
      'package_redemption',
      fpr.redemption_date,
      fpr.recognized_revenue_amount,
      'fct_package_redemptions',
      fpr.zenoti_redemption_id
    FROM fct_package_redemptions fpr
    JOIN fct_visit_services fvs ON fvs.visit_service_id = fpr.visit_service_id
    JOIN fct_visits fv ON fv.visit_id = fvs.visit_id
    WHERE fpr.tenant_id = p_tenant_id
      AND fpr.redemption_date BETWEEN p_start_date AND p_end_date;

    -- Membership billing revenue
    INSERT INTO fct_revenue_events (
      tenant_id, patient_id, visit_id, visit_service_id, provider_id,
      category_id, location_id, revenue_type, earned_date, earned_amount,
      source_table, source_id
    )
    SELECT
      fmb.tenant_id,
      fmb.patient_id,
      NULL,
      NULL,
      NULL,
      dmt.membership_type_id,
      NULL,
      'membership',
      fmb.bill_date,
      fmb.amount_collected,
      'fct_membership_billing',
      fmb.zenoti_billing_id
    FROM fct_membership_billing fmb
    JOIN dim_membership_types dmt ON dmt.membership_type_id = fmb.membership_type_id
    WHERE fmb.tenant_id = p_tenant_id
      AND fmb.bill_date BETWEEN p_start_date AND p_end_date;

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Calculated %s revenue events', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- calculate_cost_events — Populate fct_cost_events from inventory + pay rules
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_cost_events(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  v_run_id := util.start_program_run(p_tenant_id, 'calculate_cost_events',
    jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    NULL, p_code_version);

  BEGIN
    -- Delete existing cost events for the date range (idempotent)
    DELETE FROM fct_cost_events
    WHERE tenant_id = p_tenant_id
      AND recognized_date BETWEEN p_start_date AND p_end_date;

    -- Consumable costs from inventory usage
    INSERT INTO fct_cost_events (
      tenant_id, patient_id, visit_id, visit_service_id, provider_id,
      category_id, location_id, cost_type, recognized_date,
      direct_cost_amount, source_table, source_id
    )
    SELECT
      fiu.tenant_id,
      fv.patient_id,
      fv.visit_id,
      fiu.visit_service_id,
      fvs.provider_id,
      fvs.category_id,
      fv.location_id,
      'consumables',
      fiu.usage_date,
      fiu.extended_cost,
      'fct_inventory_usage',
      fiu.usage_id::TEXT
    FROM fct_inventory_usage fiu
    JOIN fct_visit_services fvs ON fvs.visit_service_id = fiu.visit_service_id
    JOIN fct_visits fv ON fv.visit_id = fvs.visit_id
    WHERE fiu.tenant_id = p_tenant_id
      AND fiu.usage_date BETWEEN p_start_date AND p_end_date;

    -- Variable compensation from provider pay rules
    INSERT INTO fct_cost_events (
      tenant_id, patient_id, visit_id, visit_service_id, provider_id,
      category_id, location_id, cost_type, recognized_date,
      direct_cost_amount, source_table, source_id
    )
    SELECT
      fvs.tenant_id,
      fv.patient_id,
      fvs.visit_id,
      fvs.visit_service_id,
      fvs.provider_id,
      fvs.category_id,
      fv.location_id,
      'variable_compensation',
      fvs.earned_date,
      CASE
        WHEN dpr.compensation_model = 'percentage' THEN
          ROUND(fvs.net_revenue * COALESCE(dpr.commission_rate, 0), 2)
        WHEN dpr.compensation_model = 'flat' THEN
          COALESCE(dpr.base_rate, 0)
        ELSE 0
      END,
      'ref_provider_pay_rules',
      dpr.provider_id::TEXT
    FROM fct_visit_services fvs
    JOIN fct_visits fv ON fv.visit_id = fvs.visit_id
    JOIN dim_providers dpr ON dpr.provider_id = fvs.provider_id
      AND dpr.effective_end = '2100-12-31'::DATE
    WHERE fvs.tenant_id = p_tenant_id
      AND fvs.earned_date BETWEEN p_start_date AND p_end_date
      AND fvs.provider_id IS NOT NULL;

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Calculated %s cost events', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- calculate_retention_cohorts — Calculate patient retention cohort data
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_retention_cohorts(
  p_tenant_id UUID,
  p_cohort_month TEXT,
  p_code_version TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  v_run_id := util.start_program_run(p_tenant_id, 'calculate_retention_cohorts',
    jsonb_build_object('cohort_month', p_cohort_month),
    NULL, p_code_version);

  BEGIN
    -- Mark churned patients who haven't visited in 90+ days
    UPDATE dim_patients
    SET patient_status = 'churned',
        updated_at = clock_timestamp()
    WHERE tenant_id = p_tenant_id
      AND patient_status = 'active'
      AND last_visit_date < CURRENT_DATE - INTERVAL '90 days'
      AND effective_end = '2100-12-31'::DATE;

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Updated %s patient retention statuses', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- populate_dim_dates — Generate date dimension rows for a range
-- =============================================================================

CREATE OR REPLACE FUNCTION populate_dim_dates(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_run_id BIGINT;
  v_loaded INTEGER;
BEGIN
  v_run_id := util.start_program_run(NULL, 'populate_dim_dates',
    jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
    NULL, NULL);

  BEGIN
    INSERT INTO dim_dates (
      date, day_of_week, day_name, month, month_name, quarter, year,
      year_month, year_quarter, is_weekend, is_holiday
    )
    SELECT
      d::DATE,
      EXTRACT(ISODOW FROM d)::INTEGER - 1,   -- 0=Sunday
      TRIM(TO_CHAR(d, 'Day')),
      EXTRACT(MONTH FROM d)::INTEGER,
      TRIM(TO_CHAR(d, 'Month')),
      EXTRACT(QUARTER FROM d)::INTEGER,
      EXTRACT(YEAR FROM d)::INTEGER,
      TO_CHAR(d, 'YYYY-MM'),
      TO_CHAR(d, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM d)::TEXT,
      EXTRACT(ISODOW FROM d) IN (6, 7),
      false
    FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') AS d
    ON CONFLICT (date) DO NOTHING;

    GET DIAGNOSTICS v_loaded = ROW_COUNT;

    PERFORM util.complete_program_run(v_run_id, 'completed',
      format('Populated %s date rows', v_loaded));

    RETURN v_loaded;
  EXCEPTION WHEN OTHERS THEN
    PERFORM util.complete_program_run(v_run_id, 'failed',
      NULL, 'OUR_BUG', NULL, SQLERRM);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
