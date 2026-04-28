// =============================================================================
// HTTP Client — Fetch wrapper with retry and timeout (EP §15)
// Implements: EP §15 (dependencies flow down), DR-040 (retry with backoff)
// ============================================================================

import { retryWithBackoff } from './retry.js';
/** HTTP client configuration */
export interface HttpClientConfig {
  /** Base URL for all requests */
  baseUrl: string;
  /** Default headers (e.g., Authorization) */
  headers?: Record<string, string>;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
}

/** Typed response wrapper */
export interface HttpResponse<T> {
  status: number;
  data: T;
  headers: Headers;
}

/**
 * Create a configured HTTP client instance.
 * Supports typed GET/POST/PUT/DELETE with automatic retry.
 *
 * @param config — Client configuration
 * @returns HTTP client with typed request methods
 */
export function createHttpClient(config: HttpClientConfig) {
  const timeout = config.timeout ?? 30_000;
  const maxRetries = config.maxRetries ?? 3;

  /** Core request function with retry logic */
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<HttpResponse<T>> {
    const url = `${config.baseUrl}${path}`;
    const result = await retryWithBackoff(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new HttpError(response.status, await response.text(), url);
          }

          const data = (await response.json()) as T;
          return { status: response.status, data, headers: response.headers };
        } finally {
          clearTimeout(timer);
        }
      },
      { maxRetries, shouldRetry: isRetryableError },
    );
    return result;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
  };
}

/** HTTP error with status code for retry classification */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`HTTP ${status}: ${url}`);
    this.name = 'HttpError';
  }
}

/**
 * Determine if an HTTP error is retryable.
 * Retry on 429, 502, 503, 504 and network errors.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return [429, 502, 503, 504].includes(error.status);
  }
  // Network/abort errors are retryable
  if (error instanceof TypeError || error instanceof DOMException) {
    return true;
  }
  return false;
}
