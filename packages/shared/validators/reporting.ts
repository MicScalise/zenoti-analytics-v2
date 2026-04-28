// =============================================================================
// Zod Validators — Reporting request validation (DD-32 reporting endpoints)
// Implements: EP §14, DD-31 §6.7–6.8 (fct_revenue_events, fct_cost_events)
// ============================================================================

import { z } from 'zod';

/** KPI query parameters — date range required, optional filters */
export const kpiQuerySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  location_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
}).refine(
  (data) => data.start_date <= data.end_date,
  { message: 'start_date must be on or before end_date' },
);

/** Revenue report query */
export const revenueQuerySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  location_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  revenue_type: z.enum(['earned', 'package_redemption', 'membership']).optional(),
  group_by: z.enum(['day', 'week', 'month', 'provider', 'category', 'location']).optional(),
}).refine(
  (data) => data.start_date <= data.end_date,
  { message: 'start_date must be on or before end_date' },
);

/** Cost report query */
export const costQuerySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  location_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  cost_type: z.enum(['consumables', 'variable_compensation']).optional(),
  group_by: z.enum(['day', 'week', 'month', 'provider', 'category']).optional(),
}).refine(
  (data) => data.start_date <= data.end_date,
  { message: 'start_date must be on or before end_date' },
);

/** Retention cohort query */
export const retentionQuerySchema = z.object({
  cohort_start: z.string(),
  cohort_end: z.string(),
  location_id: z.string().uuid().optional(),
});

/** Sync trigger request — start an extraction run */
export const syncTriggerSchema = z.object({
  entity_type: z.enum([
    'patients', 'appointments', 'services', 'payments',
    'packages', 'memberships', 'inventory_items', 'inventory_lots',
    'inventory_usage', 'employees', 'rooms',
  ]),
  location_id: z.string().uuid().optional(),
  full_sync: z.boolean().default(false),
});

export type KpiQueryInput = z.infer<typeof kpiQuerySchema>;
export type RevenueQueryInput = z.infer<typeof revenueQuerySchema>;
export type CostQueryInput = z.infer<typeof costQuerySchema>;
export type RetentionQueryInput = z.infer<typeof retentionQuerySchema>;
export type SyncTriggerInput = z.infer<typeof syncTriggerSchema>;
