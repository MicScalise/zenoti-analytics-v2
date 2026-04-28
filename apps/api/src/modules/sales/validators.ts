// =============================================================================
// Sales Validators — Request validation for sales/payment routes
// Implements: DD-32 §8 (sales & revenue endpoints)
// ============================================================================

import { ValidationError } from '../identity/validators.js';

/** Validate payment creation body */
export function validateCreatePayment(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.patientId || typeof body.patientId !== 'string') {
    errors.push({ field: 'patientId', issue: 'required and must be a string' });
  }
  if (!body.paymentDate || typeof body.paymentDate !== 'string') {
    errors.push({ field: 'paymentDate', issue: 'required ISO date string' });
  }
  if (typeof body.amount !== 'number' || body.amount <= 0) {
    errors.push({ field: 'amount', issue: 'required positive number' });
  }
  if (!body.tenderType || !['credit', 'cash', 'check', 'package', 'membership'].includes(body.tenderType as string)) {
    errors.push({ field: 'tenderType', issue: 'must be a valid tender type' });
  }
  if (!body.liabilityAccountType || !['deferred_revenue', 'revenue'].includes(body.liabilityAccountType as string)) {
    errors.push({ field: 'liabilityAccountType', issue: 'must be deferred_revenue or revenue' });
  }
  return errors;
}

/** Validate package redemption body */
export function validateCreateRedemption(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.packageId || typeof body.packageId !== 'string') {
    errors.push({ field: 'packageId', issue: 'required' });
  }
  if (!body.patientId || typeof body.patientId !== 'string') {
    errors.push({ field: 'patientId', issue: 'required' });
  }
  if (!body.visitServiceId || typeof body.visitServiceId !== 'string') {
    errors.push({ field: 'visitServiceId', issue: 'required' });
  }
  if (typeof body.unitsRedeemed !== 'number' || body.unitsRedeemed <= 0) {
    errors.push({ field: 'unitsRedeemed', issue: 'required positive number' });
  }
  return errors;
}
