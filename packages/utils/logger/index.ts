// =============================================================================
// Logger — Pino structured logging setup (EP §11)
// Implements: EP §11 (structured logging with verbose mode)
// JSON output in staging/production, pretty output in development.
// ============================================================================

import pino from 'pino';

/**
 * Create a configured Pino logger instance.
 * Uses pino-pretty in development for readable output.
 * JSON structured logs in staging/production for log aggregation.
 *
 * @param name — Logger name (typically module path)
 * @param level — Log level (defaults to LOG_LEVEL env var or 'info')
 * @returns Configured Pino logger
 */
export function createLogger(name: string, level?: string) {
  const logLevel = level ?? process.env.LOG_LEVEL ?? 'info';
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

  const transport = isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined;

  return pino({
    name,
    level: logLevel,
    // Include hostname and pid for distributed tracing
    base: { pid: process.pid, hostname: process.env.HOSTNAME },
    // ISO 8601 timestamps for log aggregation
    timestamp: pino.stdTimeFunctions.isoTime,
    // Redact sensitive fields (PHI, credentials)
    redact: {
      paths: ['password', 'password_hash', 'zenoti_api_key', 'email', 'phone',
              'ssn', 'credit_card', 'authorization'],
      censor: '[REDACTED]',
    },
    transport,
  });
}

/** Default application logger */
export const logger = createLogger('app');
