// =============================================================================
// Test Factory — Payment (DD-31 §6.3 fct_payments)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { Payment, TenderType } from '@za/shared';

let counter = 0;

/**
 * Build a Payment test fixture with sensible defaults.
 * All field names match DD-31 §6.3 column names exactly.
 * Exactly one of visit_id, package_id, membership_id must be set.
 */
export function buildPayment(overrides: Partial<Payment> = {}): Payment {
  counter++;
  return {
    payment_id: `90000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    zenoti_payment_id: `zenoti-payment-${counter}`,
    patient_id: '20000000-0000-0000-0000-000000000001',
    visit_id: '50000000-0000-0000-0000-000000000001',
    payment_date: '2026-04-27',
    amount: 200.00,
    tender_type: 'credit' as TenderType,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
