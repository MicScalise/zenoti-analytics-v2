-- =============================================================================
-- 001_enums_and_config.sql — ENUM types, config_tenants, config_users
-- Implements: TASK-002
-- Source: DD-31 §4 (ENUM types), §9.1 (config_tenants), §9.2 (config_users)
-- =============================================================================

-- 4.1 Tenant billing lifecycle
CREATE TYPE tenant_billing_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'purge_scheduled',
  'purged'
);

-- 4.2 Visit status (state machine per DD-33)
CREATE TYPE visit_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled',
  'no_show'
);

-- 4.3 Payment tender type
CREATE TYPE tender_type AS ENUM (
  'credit',
  'cash',
  'check',
  'package',
  'membership'
);

-- 4.4 Liability account type (accounting)
CREATE TYPE liability_account_type AS ENUM (
  'deferred_revenue',
  'revenue'
);

-- 4.5 Cost type
CREATE TYPE cost_type AS ENUM (
  'consumables',
  'variable_compensation'
);

-- 4.6 Revenue type
CREATE TYPE revenue_type AS ENUM (
  'earned',
  'package_redemption',
  'membership'
);

-- 4.7 Provider role
CREATE TYPE provider_role AS ENUM (
  'injector',
  'esthetician',
  'manager',
  'admin'
);

-- 4.8 Compensation model
CREATE TYPE compensation_model AS ENUM (
  'flat',
  'percentage',
  'tiered'
);

-- 4.9 Product type (inventory category)
CREATE TYPE product_type AS ENUM (
  'neuromodulator',
  'dermal_filler',
  'skincare',
  'retail',
  'disposable'
);

-- 4.10 Room type
CREATE TYPE room_type AS ENUM (
  'treatment',
  'consultation',
  'laser',
  'general'
);

-- 4.11 Extraction run status
CREATE TYPE extraction_status AS ENUM (
  'running',
  'completed',
  'failed',
  'skipped'
);

-- 4.12 Program run status
CREATE TYPE program_status AS ENUM (
  'running',
  'completed',
  'failed',
  'blocked'
);

-- 4.13 Error class (Principle 21)
CREATE TYPE error_class AS ENUM (
  'OUR_BUG',
  'UPSTREAM_DOWN',
  'INFRA',
  'DATA_QUALITY',
  'CONFIG'
);

-- 4.14 Patient status
CREATE TYPE patient_status AS ENUM (
  'active',
  'churned',
  'inactive'
);

-- =============================================================================
-- 9.1 config_tenants — Master tenant record (not tenant-scoped)
-- =============================================================================

CREATE TABLE config_tenants (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name TEXT NOT NULL,
  zenoti_api_key TEXT NOT NULL,
  zenoti_subdomain TEXT NOT NULL,
  pay_period_type TEXT NOT NULL CHECK (pay_period_type IN ('weekly','biweekly')),
  pay_period_anchor_day INTEGER NOT NULL CHECK (pay_period_anchor_day BETWEEN 0 AND 6),
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  billing_status tenant_billing_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ NULL,

  -- Provenance (system tenant record, not user-loaded)
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_config_tenants_zenoti_subdomain
  ON config_tenants(zenoti_subdomain);

-- No RLS — this table defines the tenants; access controlled by role

-- =============================================================================
-- 9.2 config_users — User master (authentication identity)
-- =============================================================================

CREATE TABLE config_users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES config_tenants(tenant_id),

  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','clinical','staff','readonly')),
  mfa_secret_encrypted TEXT NULL,
  login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  last_login_ip INET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uq_config_users_email_tenant
  ON config_users(tenant_id, email);

-- RLS enabled in 005_rls_policies.sql
