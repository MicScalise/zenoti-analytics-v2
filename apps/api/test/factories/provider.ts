// =============================================================================
// Test Factory — Provider (DD-31 §5.2 dim_providers)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { Provider, ProviderRole, CompensationModel } from '@za/shared';

let counter = 0;

/**
 * Build a Provider test fixture with sensible defaults.
 * All field names match DD-31 §5.2 column names exactly.
 */
export function buildProvider(overrides: Partial<Provider> = {}): Provider {
  counter++;
  return {
    provider_id: `40000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    zenoti_employee_id: `zenoti-employee-${counter}`,
    first_name: 'Dr.',
    last_name: `Smith${counter}`,
    role: 'injector' as ProviderRole,
    compensation_model: 'percentage' as CompensationModel,
    commission_rate: 0.25,
    location_id: '30000000-0000-0000-0000-000000000001',
    is_active: true,
    effective_start: '2025-01-01',
    effective_end: '2100-12-31',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
