// =============================================================================
// Zod Validators — Sales request validation (DD-32 sales endpoints)
// Implements: EP §14, DD-31 §6.3–6.5 (fct_payments, fct_package_redemptions,
// fct_membership_billing columns)
// Field names match DD-31 column names exactly.
// ============================================================================

import { z } from 'zod';

/** Create payment request body */
export const createPaymentSchema = z.object({
  zenoti_payment_id: z.string().min(1),
  patient_id: z.string().uuid(),
  visit_id: z.string().uuid().optional(),
  package_id: z.string().optional(),
  membership_id: z.string().optional(),
  payment_date: z.string(),
  amount: z.number().positive(),
  tender_type: z.enum(['credit', 'cash', 'check', 'package', 'membership']),
  liability_account_type: z.enum(['deferred_revenue', 'revenue']).optional(),
}).refine(
  // Exactly one of visit_id, package_id, membership_id must be set (DD-31 §6.3)
  (data) => {
    const set = [data.visit_id, data.package_id, data.membership_id].filter(Boolean);
    return set.length === 1;
  },
  { message: 'Exactly one of visit_id, package_id, or membership_id must be provided' },
);

/** Create package redemption request body */
export const createRedemptionSchema = z.object({
  zenoti_redemption_id: z.string().min(1),
  package_id: z.string().min(1),
  patient_id: z.string().uuid(),
  visit_service_id: z.string().uuid(),
  redemption_date: z.string(),
  units_redeemed: z.number().positive(),
  recognized_revenue_amount: z.number().nonnegative(),
});

/** Sales query filter */
export const salesQuerySchema = z.object({
  patient_id: z.string().uuid().optional(),
  tender_type: z.enum(['credit', 'cash', 'check', 'package', 'membership']).optional(),
  payment_date_from: z.string().optional(),
  payment_date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateRedemptionInput = z.infer<typeof createRedemptionSchema>;
export type SalesQueryInput = z.infer<typeof salesQuerySchema>;
