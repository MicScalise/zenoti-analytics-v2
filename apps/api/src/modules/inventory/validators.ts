// =============================================================================
// Inventory Validators — Request validation for inventory routes
// Implements: DD-32 §9 (inventory endpoints)
// ============================================================================

import { ValidationError } from '../identity/validators.js';

/** Validate inventory usage record body */
export function validateRecordUsage(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.visitServiceId || typeof body.visitServiceId !== 'string') {
    errors.push({ field: 'visitServiceId', issue: 'required' });
  }
  if (!body.inventoryItemId || typeof body.inventoryItemId !== 'string') {
    errors.push({ field: 'inventoryItemId', issue: 'required' });
  }
  if (typeof body.quantityUsed !== 'number' || body.quantityUsed <= 0) {
    errors.push({ field: 'quantityUsed', issue: 'required positive number' });
  }
  if (typeof body.unitCostAtTime !== 'number' || body.unitCostAtTime < 0) {
    errors.push({ field: 'unitCostAtTime', issue: 'required non-negative number' });
  }
  return errors;
}

/** Validate lot creation body */
export function validateCreateLot(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.itemId || typeof body.itemId !== 'string') {
    errors.push({ field: 'itemId', issue: 'required' });
  }
  if (!body.lotNumber || typeof body.lotNumber !== 'string') {
    errors.push({ field: 'lotNumber', issue: 'required' });
  }
  if (!body.expirationDate || typeof body.expirationDate !== 'string') {
    errors.push({ field: 'expirationDate', issue: 'required date string' });
  }
  if (typeof body.receivedQuantity !== 'number' || body.receivedQuantity <= 0) {
    errors.push({ field: 'receivedQuantity', issue: 'required positive number' });
  }
  return errors;
}
