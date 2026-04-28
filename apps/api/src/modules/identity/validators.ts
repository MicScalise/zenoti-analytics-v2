// =============================================================================
// Identity Validators — Request validation for auth routes
// Implements: DD-32 §4 (authentication endpoints)
// ============================================================================

// import { Request, Response, NextFunction } from 'express'; // Unused

/** Validation error with field-level detail */
export interface ValidationError {
  field: string;
  issue: string;
}

/**
 * Validate POST /auth/login request body.
 * DD-32 §4.1: requires email, password, clientType.
 *
 * @param body — request body
 * @returns array of validation errors (empty if valid)
 */
export function validateLogin(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.email || typeof body.email !== 'string') {
    errors.push({ field: 'email', issue: 'required and must be a string' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email as string)) {
    errors.push({ field: 'email', issue: 'invalid_format' });
  }

  if (!body.password || typeof body.password !== 'string') {
    errors.push({ field: 'password', issue: 'required and must be a string' });
  }

  if (!body.clientType || !['web', 'mobile'].includes(body.clientType as string)) {
    errors.push({ field: 'clientType', issue: 'must be "web" or "mobile"' });
  }

  return errors;
}

/**
 * Validate POST /auth/refresh request body.
 * DD-32 §4.3: requires refreshToken.
 */
export function validateRefresh(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.refreshToken || typeof body.refreshToken !== 'string') {
    errors.push({ field: 'refreshToken', issue: 'required and must be a string' });
  }

  return errors;
}

/**
 * Validate POST /auth/mfa/verify request body.
 * DD-32 §4.4: requires userId, mfaCode, clientType.
 */
export function validateMfaVerify(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.userId || typeof body.userId !== 'string') {
    errors.push({ field: 'userId', issue: 'required and must be a string' });
  }

  if (!body.mfaCode || typeof body.mfaCode !== 'string') {
    errors.push({ field: 'mfaCode', issue: 'required and must be a string' });
  }

  if (!body.clientType || !['setup', 'challenge'].includes(body.clientType as string)) {
    errors.push({ field: 'clientType', issue: 'must be "setup" or "challenge"' });
  }

  return errors;
}

/**
 * Validate user creation input (for potential register endpoints).
 */
export function validateCreateUser(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.email || typeof body.email !== 'string') {
    errors.push({ field: 'email', issue: 'required and must be a string' });
  }

  if (!body.password || typeof body.password !== 'string' || (body.password as string).length < 8) {
    errors.push({ field: 'password', issue: 'required and must be at least 8 characters' });
  }

  if (!body.role || !['owner', 'admin', 'clinical', 'staff', 'readonly'].includes(body.role as string)) {
    errors.push({ field: 'role', issue: 'must be a valid role' });
  }

  return errors;
}
