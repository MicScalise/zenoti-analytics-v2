// =============================================================================
// Shared Types — API request/response envelopes (DD-32 §3)
// Implements: EP §8 (single source of truth), EP §14 (validation at every step)
// ============================================================================

/** Standard API envelope for all responses */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/** Error detail in API responses */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

/** Pagination and request metadata */
export interface ApiMeta {
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
  request_id?: string;
}

/** Pagination query parameters */
export interface PaginationParams {
  page?: number;
  per_page?: number;
}

/** Date range filter used across reporting endpoints */
export interface DateRangeFilter {
  start_date: string;
  end_date: string;
}

/** Tenant-scoped request — tenant_id comes from auth context, not body */
export interface TenantScopedRequest {
  // tenant_id is injected by middleware, not sent by client
}

/** Auth login request (DD-32 auth endpoints) */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Auth login response */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: PublicUser;
}

/** Public user — safe to return to client (DR-029: never return password_hash) */
export interface PublicUser {
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
}

/** Refresh token request */
export interface RefreshRequest {
  refresh_token: string;
}

/** KPI query parameters */
export interface KpiQueryParams extends DateRangeFilter, PaginationParams {
  location_id?: string;
  provider_id?: string;
  category_id?: string;
}

/** Revenue summary response */
export interface RevenueSummary {
  total_revenue: number;
  earned_revenue: number;
  deferred_revenue: number;
  period: DateRangeFilter;
}
