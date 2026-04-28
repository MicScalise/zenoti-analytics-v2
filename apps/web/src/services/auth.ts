// =============================================================================
// auth.ts — Authentication service (token storage + login/logout API calls)
// Implements: REQ-SEC-02 (auth state management), DD-32 §4 (auth endpoints)
// =============================================================================

import { apiClient } from './api.js';

/** Storage key for the auth token. */
const TOKEN_KEY = 'za_session_token';

/** Storage key for the refresh token. */
const REFRESH_KEY = 'za_refresh_token';

/** Auth response shape from POST /auth/login (DD-32 §4.1). */
interface LoginResponse {
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string;
}

/**
 * Retrieves the stored auth token from localStorage.
 * Returns undefined if no token exists.
 */
export function getAuthToken(): string | undefined {
  return localStorage.getItem(TOKEN_KEY) ?? undefined;
}

/**
 * Stores the auth token in localStorage.
 *
 * @param token — JWT or session token from login response
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clears the auth token and refresh token from storage.
 * Called on logout or 401/403 responses (DR-045).
 */
export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/**
 * Derives tenantId from email domain.
 * For multi-tenant SaaS, tenant is typically encoded in email domain
 * or provided via separate tenant lookup. Here we use the domain part
 * as a simple derivation strategy for development/testing.
 *
 * @param email — User email address
 * @returns tenantId derived from email domain
 */
function deriveTenantId(email: string): string {
  const domain = email.split('@')[1] ?? 'unknown';
  // Use domain as tenant slug (e.g., "example.com" → "example-com")
  return domain.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

/**
 * Logs in via POST /auth/login (DD-32 §4.1).
 * Stores tokens on success, throws on failure.
 *
 * Sends x-tenant-id header derived from email domain.
 *
 * @param email — User email address
 * @param password — User password
 * @returns Login response with user info and session ID
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const tenantId = deriveTenantId(email);
  const { data } = await apiClient.post<{ data: LoginResponse }>(
    '/auth/login',
    { email, password, clientType: 'web' },
    {
      headers: {
        'x-tenant-id': tenantId,
      },
    }
  );
  setAuthToken(data.data.sessionId);
  return data.data;
}

/**
 * Logs out via POST /auth/logout (DD-32 §4.2).
 * Clears local tokens regardless of API response.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    clearAuthToken();
  }
}

/**
 * Refreshes the auth token via POST /auth/refresh (DD-32 §4.3).
 * Stores the new tokens on success.
 */
export async function refreshToken(): Promise<void> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) throw new Error('No refresh token available');
  const { data } = await apiClient.post<{ data: { accessToken: string; refreshToken: string } }>(
    '/auth/refresh',
    { refreshToken: rt }
  );
  setAuthToken(data.data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.data.refreshToken);
}
