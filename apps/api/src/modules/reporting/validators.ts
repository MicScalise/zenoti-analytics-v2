// =============================================================================
// Reporting Validators — Request validation for reporting routes
// Implements: DD-32 §10 (reporting & KPI endpoints)
// ============================================================================

import { ValidationError } from '../identity/validators.js';

/** Validate dashboard query params */
export function validateDashboardQuery(query: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (query.period && !['mtd', 'last30d', 'custom'].includes(query.period as string)) {
    errors.push({ field: 'period', issue: 'must be mtd, last30d, or custom' });
  }

  if (query.period === 'custom' && (!query.startDate || !query.endDate)) {
    errors.push({ field: 'startDate', issue: 'required when period=custom' });
  }

  return errors;
}

/** Validate revenue summary query params (startDate and endDate required) */
export function validateRevenueQuery(query: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!query.startDate || typeof query.startDate !== 'string') {
    errors.push({ field: 'startDate', issue: 'required date string' });
  }
  if (!query.endDate || typeof query.endDate !== 'string') {
    errors.push({ field: 'endDate', issue: 'required date string' });
  }

  return errors;
}
