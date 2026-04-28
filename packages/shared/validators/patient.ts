// =============================================================================
// Zod Validators — Patient request validation (DD-32 patient endpoints)
// Implements: EP §14, DD-31 §5.1 (dim_patients columns)
// Field names match DD-31 column names exactly.
// ============================================================================

import { z } from 'zod';

/** Create patient request body */
export const createPatientSchema = z.object({
  zenoti_patient_id: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  acquisition_source_id: z.string().uuid().optional(),
  location_id: z.string().uuid(),
});

/** Update patient request body — all fields optional */
export const updatePatientSchema = createPatientSchema.partial();

/** Patient query filter */
export const patientQuerySchema = z.object({
  patient_status: z.enum(['active', 'churned', 'inactive']).optional(),
  location_id: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQueryInput = z.infer<typeof patientQuerySchema>;
