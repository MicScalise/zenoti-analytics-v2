// =============================================================================
// Logger Formatters — Structured log field formatting (EP §11)
// ============================================================================

/**
 * Format a tenant context object for structured logging.
 * Includes tenant_id for RLS audit trail correlation.
 *
 * @param tenantId — Current tenant ID from auth context
 * @param userId — Current user ID from auth context (optional)
 * @returns Formatted context object for log fields
 */
export function formatTenantContext(tenantId: string, userId?: string) {
  return {
    tenant_id: tenantId,
    user_id: userId,
  };
}

/**
 * Format an extraction run for structured logging.
 * Used by extraction workers to correlate log entries with audit rows.
 *
 * @param extractionRunId — UUID of the extraction run
 * @param entityType — Entity being extracted (e.g., 'patients')
 * @returns Formatted extraction context
 */
export function formatExtractionContext(extractionRunId: string, entityType: string) {
  return {
    extraction_run_id: extractionRunId,
    entity_type: entityType,
  };
}

/**
 * Format duration in milliseconds for performance logging.
 *
 * @param startMs — Start timestamp from Date.now()
 * @returns Duration object with ms and human-readable format
 */
export function formatDuration(startMs: number) {
  const durationMs = Date.now() - startMs;
  return {
    duration_ms: durationMs,
    duration_human: durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(2)}s`,
  };
}

/**
 * Format a database query for structured logging.
 * Redacts parameterized values to prevent PHI/credential leakage.
 *
 * @param query — SQL query string (parameterized with $1, $2, etc.)
 * @param durationMs — Query execution time in ms
 * @returns Formatted query log entry
 */
export function formatQueryLog(query: string, durationMs: number) {
  return {
    query: query.substring(0, 500), // Truncate long queries
    duration_ms: durationMs,
    // Values intentionally excluded — may contain PHI
  };
}
