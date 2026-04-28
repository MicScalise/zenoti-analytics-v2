// =============================================================================
// Test Factory — Tenant (DD-31 §9.1 config_tenants)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { Tenant, TenantBillingStatus } from '@za/shared';

let counter = 0;

/**
 * Build a Tenant test fixture with sensible defaults.
 * All field names match DD-31 §9.1 column names exactly.
 *
 * @param overrides — Partial override of default values
 * @returns Complete Tenant object
 */
export function buildTenant(overrides: Partial<Tenant> = {}): Tenant {
  counter++;
  return {
    tenant_id: `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_name: `Test Tenant ${counter}`,
    zenoti_api_key: `test-api-key-${counter}`,
    zenoti_subdomain: `test-subdomain-${counter}`,
    pay_period_type: 'biweekly',
    pay_period_anchor_day: 1,
    timezone: 'America/Los_Angeles',
    billing_status: 'active' as TenantBillingStatus,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
