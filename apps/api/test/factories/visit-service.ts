// =============================================================================
// Test Factory — VisitService (DD-31 §6.2 fct_visit_services)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { VisitService } from '@za/shared';

let counter = 0;

/**
 * Build a VisitService test fixture with sensible defaults.
 * All field names match DD-31 §6.2 column names exactly.
 * net_revenue = gross_revenue - discounts (DD-31 CHECK constraint).
 */
export function buildVisitService(overrides: Partial<VisitService> = {}): VisitService {
  counter++;
  const gross = 200.00;
  const discounts = 0;
  return {
    visit_service_id: `60000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    zenoti_visit_service_id: `zenoti-vs-${counter}`,
    visit_id: '50000000-0000-0000-0000-000000000001',
    service_id: '70000000-0000-0000-0000-000000000001',
    category_id: '80000000-0000-0000-0000-000000000001',
    quantity: 1,
    gross_revenue: gross,
    discounts,
    net_revenue: gross - discounts,
    earned_date: '2026-04-27',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
