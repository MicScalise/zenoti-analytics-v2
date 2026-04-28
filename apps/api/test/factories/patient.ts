// =============================================================================
// Test Factory — Patient (DD-31 §5.1 dim_patients)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { Patient, PatientStatus } from '@za/shared';

let counter = 0;

/**
 * Build a Patient test fixture with sensible defaults.
 * All field names match DD-31 §5.1 column names exactly.
 */
export function buildPatient(overrides: Partial<Patient> = {}): Patient {
  counter++;
  return {
    patient_id: `20000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    zenoti_patient_id: `zenoti-patient-${counter}`,
    first_name: 'Jane',
    last_name: `Doe${counter}`,
    patient_status: 'active' as PatientStatus,
    location_id: '30000000-0000-0000-0000-000000000001',
    effective_start: '2025-01-01',
    effective_end: '2100-12-31',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
