// =============================================================================
// Test Factory — Visit (DD-31 §6.1 fct_visits)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { Visit, VisitStatus } from '@za/shared';

let counter = 0;

/**
 * Build a Visit test fixture with sensible defaults.
 * All field names match DD-31 §6.1 column names exactly.
 */
export function buildVisit(overrides: Partial<Visit> = {}): Visit {
  counter++;
  return {
    visit_id: `50000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    zenoti_visit_id: `zenoti-visit-${counter}`,
    patient_id: '20000000-0000-0000-0000-000000000001',
    location_id: '30000000-0000-0000-0000-000000000001',
    visit_date: '2026-04-27',
    visit_status: 'scheduled' as VisitStatus,
    is_new_patient_visit: false,
    no_show_flag: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
