// =============================================================================
// Retry Logic — Exponential backoff with jitter (EP §15)
// Implements: DR-040 (retry with backoff for upstream failures)
// ============================================================================

/** Retry configuration */
export interface RetryConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  multiplier?: number;
  /** Predicate to determine if error is retryable */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Execute a function with exponential backoff retry.
 * Adds jitter to prevent thundering herd on shared failures.
 *
 * @param fn — Async function to execute
 * @param config — Retry configuration
 * @returns Result of successful function execution
 * @throws Last error if all retries exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const maxRetries = config.maxRetries ?? 3;
  const initialDelay = config.initialDelay ?? 1000;
  const maxDelay = config.maxDelay ?? 30_000;
  const multiplier = config.multiplier ?? 2;
  const shouldRetry = config.shouldRetry ?? (() => true);

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if max attempts reached or error is not retryable
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const baseDelay = Math.min(initialDelay * Math.pow(multiplier, attempt), maxDelay);
      const jitter = baseDelay * (0.5 + Math.random() * 0.5);
      const delay = Math.round(jitter);

      await sleep(delay);
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}

/**
 * Non-blocking sleep utility.
 *
 * @param ms — Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
