// =============================================================================
// Zod Validators — Appointment/Visit request validation (DD-32 appointment endpoints)
// Implements: EP §14, DD-31 §6.1 (fct_visits columns)
// Field names match DD-31 column names exactly.
// ============================================================================

import { z } from 'zod';

/** Create visit/appointment request body */
export const createVisitSchema = z.object({
  zenoti_visit_id: z.string().min(1),
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
  appointment_id: z.string().optional(),
  visit_date: z.string(),
  actual_start: z.string().optional(),
  actual_end: z.string().optional(),
  scheduled_duration_minutes: z.number().int().min(0).optional(),
  visit_status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  is_new_patient_visit: z.boolean().default(false),
});

/** Update visit status (state machine per DD-33) */
export const updateVisitStatusSchema = z.object({
  visit_status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']),
  actual_start: z.string().optional(),
  actual_end: z.string().optional(),
  actual_duration_minutes: z.number().int().min(0).optional(),
});

/** Visit query filter */
export const visitQuerySchema = z.object({
  visit_status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
  provider_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  visit_date_from: z.string().optional(),
  visit_date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitStatusInput = z.infer<typeof updateVisitStatusSchema>;
export type VisitQueryInput = z.infer<typeof visitQuerySchema>;
