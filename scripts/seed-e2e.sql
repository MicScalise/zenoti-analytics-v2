-- =============================================================================
-- seed-e2e.sql — E2E test data: tenant + admin user with bcrypt-hashed password
-- Password: 'TestPass123!' (bcryptjs hash, 12 rounds)
-- =============================================================================

-- Insert test tenant (idempotent — skip if exists)
INSERT INTO config_tenants (tenant_id, tenant_name, zenoti_api_key, zenoti_subdomain, pay_period_type, pay_period_anchor_day, timezone, billing_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'E2E Test Tenant',
  'e2e-test-api-key-not-real',
  'e2e-test',
  'biweekly',
  1,
  'America/Los_Angeles',
  'active'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Insert test admin user (idempotent — skip if exists)
-- Password: TestPass123! → $2b$12$sP5cM3giGyXVcVeTX9PnQeVaSThZyivyXnRu0qh/r1FSu5S1FhTWy
INSERT INTO config_users (user_id, tenant_id, email, password_hash, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'admin@test.zenoti-analytics.com',
  '$2b$12$sP5cM3giGyXVcVeTX9PnQeVaSThZyivyXnRu0qh/r1FSu5S1FhTWy',
  'admin',
  true
)
ON CONFLICT (tenant_id, email) DO NOTHING;
