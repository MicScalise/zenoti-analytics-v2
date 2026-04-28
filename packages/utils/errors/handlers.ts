// =============================================================================
// Error Handlers — Error handling utilities (EP §21)
// Implements: DR-037 (no (req as any) casts), EP §11 (structured error logging)
// NOTE: Express-specific handler lives in apps/api middleware. This file
// provides generic error normalization usable in any workspace.
// ============================================================================

import { AppError, classifyPgError } from './index.js';

/**
 * Convert an unknown error into an AppError with proper classification.
 * Handles: AppError (pass through), pg errors, Zod errors, unknown errors.
 *
 * @param error — Thrown error of unknown type
 * @returns Classified AppError instance
 */
export function normalizeError(error: unknown): AppError {
  // Already classified
  if (error instanceof AppError) {
    return error;
  }
  // Zod validation error
  if (typeof error === 'object' && error !== null && 'issues' in error) {
    const zodErr = error as { issues: Array<{ message: string; path: string[] }> };
    const details: Record<string, string> = {};
    for (const issue of zodErr.issues) {
      details[issue.path.join('.')] = issue.message;
    }
    return new AppError('Validation failed', 'DATA_QUALITY', 'VALIDATION', true, { details });
  }
  // PostgreSQL error — has code + severity
  if (
    typeof error === 'object' && error !== null &&
    'code' in error && 'severity' in error
  ) {
    const pgErr = error as unknown as { code?: string; message: string };
    return classifyPgError(pgErr);
  }
  // Generic Error
  if (error instanceof Error) {
    return new AppError(error.message, 'OUR_BUG', 'UNEXPECTED', false);
  }
  // Unknown
  return new AppError(String(error), 'OUR_BUG', 'UNKNOWN', false);
}

/**
 * Map error class to HTTP status code.
 * Used by Express error handler middleware in apps/api.
 */
export function errorToHttpStatus(error: AppError): number {
  switch (error.errorClass) {
    case 'DATA_QUALITY': return 400;
    case 'CONFIG': return 500;
    case 'UPSTREAM_DOWN': return 502;
    case 'INFRA': return 503;
    case 'OUR_BUG': return 500;
    default: return 500;
  }
}

/**
 * Format an AppError into an API response payload.
 * Only exposes details for client-visible errors.
 */
export function formatApiError(error: AppError): {
  error: { code: string; message: string; details?: Record<string, string> };
} {
  return {
    error: {
      code: error.code,
      message: error.isClientVisible ? error.message : 'Internal server error',
      ...(error.isClientVisible && error.meta?.details
        ? { details: error.meta.details as Record<string, string> }
        : {}),
    },
  };
}
