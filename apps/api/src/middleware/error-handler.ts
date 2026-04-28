// =============================================================================
// Error Handler Middleware — Classifies errors per 5-class taxonomy
// Implements: TASK-027, EP §11, EP §21
// Design: 35-security-and-observability.md §9
// =============================================================================

import { NextFunction, Request, Response } from 'express';

/** Error classification per Principle 21 and DD-35 §9 */
type ErrorClass = 'OUR_BUG' | 'UPSTREAM_DOWN' | 'INFRA' | 'DATA_QUALITY' | 'CONFIG';

/** Application error with classification for structured error handling */
export class AppError extends Error {
  public readonly errorClass: ErrorClass;
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    errorClass: ErrorClass = 'OUR_BUG',
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.errorClass = errorClass;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
  }
}

/**
 * Classify a PostgreSQL error code into our 5-class taxonomy.
 * Maps driver error codes to error classes per DD-35 §9.
 */
function classifyPgError(error: { code?: string }): ErrorClass {
  const pgCode = error.code ?? '';
  // Unique violation / check constraint → data quality
  if (['23505', '23514', '23503'].includes(pgCode)) return 'DATA_QUALITY';
  // Connection errors → infra
  if (['08003', '08006', '57P03'].includes(pgCode)) return 'INFRA';
  // Config / undefined object → config
  if (['42703', '42P01'].includes(pgCode)) return 'CONFIG';
  return 'OUR_BUG';
}

/**
 * Classify a generic error into our 5-class taxonomy.
 */
function classifyError(error: unknown): ErrorClass {
  if (error instanceof AppError) return error.errorClass;
  if (error instanceof Error) {
    // Network/upstream errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      return 'UPSTREAM_DOWN';
    }
    // Redis connection errors
    if (error.message.includes('Redis') && error.message.includes('connection')) {
      return 'INFRA';
    }
    // Missing env vars → config
    if (error.message.includes('MISSING_ENV') || error.message.includes('not defined')) {
      return 'CONFIG';
    }
    // Check for pg error code
    const pgError = error as { code?: string };
    if (pgError.code && pgError.code.length === 5) {
      return classifyPgError(pgError);
    }
  }
  return 'OUR_BUG';
}

/**
 * Map error class to HTTP status code.
 */
function errorClassToStatus(errorClass: ErrorClass): number {
  switch (errorClass) {
    case 'DATA_QUALITY': return 400;
    case 'UPSTREAM_DOWN': return 502;
    case 'INFRA': return 503;
    case 'CONFIG': return 500;
    case 'OUR_BUG': return 500;
  }
}

/**
 * Global error handler middleware. Must be mounted LAST in the middleware chain.
 * Classifies errors, returns structured JSON response, and logs details.
 *
 * DR-018: express-async-errors ensures all async rejections reach this handler.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorClass = classifyError(err);
  const statusCode = err instanceof AppError
    ? err.statusCode
    : errorClassToStatus(errorClass);
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';

  // Log with classification — structured for alert routing
  const requestId = req.headers['x-request-id'] ?? 'unknown';
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    errorClass,
    code,
    statusCode,
    message: err.message,
    requestId,
    stack: err.stack,
  }));

  // Never leak internal details in production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: isDev ? err.message : 'An internal error occurred',
      details: isDev ? [{ class: errorClass }] : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}
