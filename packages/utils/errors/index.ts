// =============================================================================
// Error Classes — Classification taxonomy per EP §21 (DD-31 §4.13)
// Implements: EP §21 (5 error classes: OUR_BUG, UPSTREAM_DOWN, INFRA,
// DATA_QUALITY, CONFIG)
// ============================================================================

// Error class type — mirrors DD-31 §4.13 error_class enum
// Duplicated here to avoid circular dependency on @za/shared
export type ErrorClass = 'OUR_BUG' | 'UPSTREAM_DOWN' | 'INFRA' | 'DATA_QUALITY' | 'CONFIG';

/** Base application error with classification and metadata */
export class AppError extends Error {
  /** Error class per EP §21 taxonomy */
  public readonly errorClass: ErrorClass;
  /** Application-specific error code (e.g., 'AUTH-001') */
  public readonly code: string;
  /** Whether this error is safe to expose to the client */
  public readonly isClientVisible: boolean;
  /** Additional structured metadata for logging */
  public readonly meta: Record<string, unknown>;

  constructor(
    message: string,
    errorClass: ErrorClass,
    code: string,
    isClientVisible = false,
    meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.errorClass = errorClass;
    this.code = code;
    this.isClientVisible = isClientVisible;
    this.meta = meta;
  }
}

/** Bug in our code — should never happen in production */
export class OurBugError extends AppError {
  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message, 'OUR_BUG', code, false, meta);
    this.name = 'OurBugError';
  }
}

/** External service (Zenoti API, etc.) is down or returning errors */
export class UpstreamDownError extends AppError {
  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message, 'UPSTREAM_DOWN', code, true, meta);
    this.name = 'UpstreamDownError';
  }
}

/** Infrastructure failure (DB, Redis, network) */
export class InfraError extends AppError {
  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message, 'INFRA', code, false, meta);
    this.name = 'InfraError';
  }
}

/** Data quality issue (missing fields, constraint violation) */
export class DataQualityError extends AppError {
  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message, 'DATA_QUALITY', code, true, meta);
    this.name = 'DataQualityError';
  }
}

/** Configuration error (missing env var, invalid setting) */
export class ConfigError extends AppError {
  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message, 'CONFIG', code, false, meta);
    this.name = 'ConfigError';
  }
}

/**
 * Classify a PostgreSQL error into our taxonomy.
 * Maps common pg error codes to EP §21 error classes.
 *
 * @param pgError — Error from pg library
 * @returns Appropriate AppError subclass
 */
export function classifyPgError(pgError: { code?: string; message: string }): AppError {
  const code = pgError.code ?? 'UNKNOWN';
  // Connection errors
  if (['57P01', '57P02', '57P03', '08001', '08003', '08006'].includes(code)) {
    return new InfraError(pgError.message, `PG-${code}`);
  }
  // Constraint violations
  if (code.startsWith('23')) {
    return new DataQualityError(pgError.message, `PG-${code}`);
  }
  // Config/permission issues
  if (['42501', '42P01', '3D000'].includes(code)) {
    return new ConfigError(pgError.message, `PG-${code}`);
  }
  return new OurBugError(pgError.message, `PG-${code}`);
}
