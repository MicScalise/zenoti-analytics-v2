// =============================================================================
// Tenants Validators — Request validation for tenant and location routes
// Implements: DD-32 §5 (tenant management endpoints)
// ============================================================================

import { ValidationError } from '../identity/validators.js';

/**
 * Validate tenant PATCH body.
 * DD-32 §5.3: timezone?, payPeriodType?, payPeriodAnchorDay?
 */
export function validateTenantUpdate(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.timezone !== undefined && typeof body.timezone !== 'string') {
    errors.push({ field: 'timezone', issue: 'must be a string' });
  }

  if (body.payPeriodType !== undefined && !['weekly', 'biweekly'].includes(body.payPeriodType as string)) {
    errors.push({ field: 'payPeriodType', issue: 'must be "weekly" or "biweekly"' });
  }

  if (body.payPeriodAnchorDay !== undefined) {
    const day = Number(body.payPeriodAnchorDay);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      errors.push({ field: 'payPeriodAnchorDay', issue: 'must be integer 1-7' });
    }
  }

  return errors;
}
