// =============================================================================
// Appointments Validators — Request validation for appointment routes
// Implements: DD-32 §7 (appointment management endpoints)
// ============================================================================

import { ValidationError } from '../identity/validators.js';

/** Validate POST /appointments body (DD-32 §7.3) */
export function validateCreateVisit(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.patientId || typeof body.patientId !== 'string') {
    errors.push({ field: 'patientId', issue: 'required and must be a string' });
  }
  if (!body.locationId || typeof body.locationId !== 'string') {
    errors.push({ field: 'locationId', issue: 'required and must be a string' });
  }
  if (!body.visitDate || typeof body.visitDate !== 'string') {
    errors.push({ field: 'visitDate', issue: 'required ISO date string' });
  }
  if (!body.scheduledDurationMinutes || typeof body.scheduledDurationMinutes !== 'number') {
    errors.push({ field: 'scheduledDurationMinutes', issue: 'required number' });
  }
  return errors;
}

/** Validate POST /appointments/:id/complete body (DD-32 §7.6) */
export function validateCompleteVisit(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.actualStart || typeof body.actualStart !== 'string') {
    errors.push({ field: 'actualStart', issue: 'required ISO datetime string' });
  }
  if (!body.actualEnd || typeof body.actualEnd !== 'string') {
    errors.push({ field: 'actualEnd', issue: 'required ISO datetime string' });
  }
  return errors;
}
