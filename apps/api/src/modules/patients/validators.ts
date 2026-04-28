// =============================================================================
// Patients Validators — Request validation for patient routes
// Implements: DD-32 §6 (patient management endpoints)
// ============================================================================

import { ValidationError } from '../identity/validators.js';

/**
 * Validate patient creation body.
 * DD-32 §6.3: firstName, lastName required; email format check.
 */
export function validateCreatePatient(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.firstName || typeof body.firstName !== 'string') {
    errors.push({ field: 'firstName', issue: 'required and must be a string' });
  }
  if (!body.lastName || typeof body.lastName !== 'string') {
    errors.push({ field: 'lastName', issue: 'required and must be a string' });
  }
  if (body.email && typeof body.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push({ field: 'email', issue: 'invalid_format' });
  }
  if (body.locationId && typeof body.locationId !== 'string') {
    errors.push({ field: 'locationId', issue: 'must be a string' });
  }

  return errors;
}

/**
 * Validate patient update body (PATCH — all fields optional).
 * DD-32 §6.4.
 */
export function validateUpdatePatient(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.email !== undefined && typeof body.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push({ field: 'email', issue: 'invalid_format' });
  }
  if (body.patientStatus !== undefined && !['active', 'churned', 'inactive'].includes(body.patientStatus as string)) {
    errors.push({ field: 'patientStatus', issue: 'must be active, churned, or inactive' });
  }

  return errors;
}

/**
 * Validate patient search query params.
 */
export function validatePatientSearch(query: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!query.search || typeof query.search !== 'string') {
    errors.push({ field: 'search', issue: 'required search term' });
  }
  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      errors.push({ field: 'limit', issue: 'must be integer 1-200' });
    }
  }

  return errors;
}
