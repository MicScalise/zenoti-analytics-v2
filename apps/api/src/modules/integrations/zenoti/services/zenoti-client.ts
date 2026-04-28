// =============================================================================
// Zenoti API Client — OAuth2 token management, rate limiting, pagination
// Implements: TASK-023, REQ-EXT-01
// Design: api-extraction-specification.md §1–2
// Defect Registry: DR-047 (no Date constructor on time strings)
// =============================================================================

import type { Logger } from 'pino';
import type { ZenotiExtractor } from '@za/shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** OAuth2 token response from Zenoti */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Generic paginated response wrapper from Zenoti API */
interface PaginatedResponse<T> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    pageSize: number;
  };
  [key: string]: T[] | unknown;
}

/** Configuration for the Zenoti client */
export interface ZenotiClientConfig {
  apiKey: string;
  subdomain: string;
  /** Requests per minute limit (default: 60) */
  rateLimitRpm?: number;
  /** Logger instance */
  logger?: Logger;
}

// ---------------------------------------------------------------------------
// Rate Limiter — Token bucket at 60 RPM
// ---------------------------------------------------------------------------

/** Token-bucket rate limiter enforcing RPM with exponential backoff on 429 */
class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private lastRefillTime: number;

  constructor(rpm: number) {
    this.maxTokens = rpm;
    this.tokens = rpm;
    // Refill one token per (60_000 / rpm) milliseconds
    this.refillIntervalMs = 60_000 / rpm;
    this.lastRefillTime = Date.now();
  }

  /** Refill tokens based on elapsed time */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /** Wait until a token is available */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    // Wait for one refill interval and retry
    await sleep(this.refillIntervalMs);
    return this.acquire();
  }
}

// ---------------------------------------------------------------------------
// Time parsing — DR-047: NEVER use new Date() on Zenoti time strings
// ---------------------------------------------------------------------------

/**
 * Parse a Zenoti time string (HH:MM or ISO partial) to minutes-since-midnight.
 * DR-047: Uses regex, NOT Date constructor, to avoid timezone shifts.
 *
 * @param timeStr — Time string like "09:30" or "2024-01-15T14:30:00"
 * @returns Minutes since midnight, or null if unparseable
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  // Extract HH:MM via regex — DR-047 compliance
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Extract date portion from a Zenoti ISO timestamp string.
 * DR-047: Regex-based, no Date constructor.
 *
 * @param isoStr — ISO timestamp like "2024-03-20T09:00:00Z"
 * @returns Date string "YYYY-MM-DD" or null
 */
export function extractDate(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  const match = String(isoStr).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay with jitter.
 * @param attempt — Zero-based retry attempt number
 * @returns Delay in milliseconds
 */
function backoffDelay(attempt: number): number {
  const base = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
  const jitter = Math.random() * 500;
  return base + jitter;
}

// ---------------------------------------------------------------------------
// ZenotiClient
// ---------------------------------------------------------------------------

/**
 * HTTP client for the Zenoti REST API.
 * Handles OAuth2 token lifecycle, rate limiting, pagination, and retries.
 *
 * DR-047: Time strings are parsed via regex, never via Date constructor.
 * DR-039: Implements pagination per api-extraction-specification.md.
 */
export class ZenotiClient implements ZenotiExtractor {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter;
  private readonly logger: Logger | Console;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private static readonly MAX_RETRIES = 3;

  constructor(config: ZenotiClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = `https://${config.subdomain}.zenoti.com`;
    this.rateLimiter = new RateLimiter(config.rateLimitRpm ?? 60);
    this.logger = config.logger ?? console;
  }

  // -----------------------------------------------------------------------
  // OAuth2 Token Management
  // -----------------------------------------------------------------------

  /**
   * Obtain or refresh the OAuth2 bearer token.
   * Tokens are cached and refreshed 5 minutes before expiry.
   */
  async ensureToken(): Promise<string> {
    // Refresh 5 minutes before expiry
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300_000) {
      return this.accessToken;
    }
    const url = `${this.baseUrl}/v1/oauth/token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey }),
    });
    if (!response.ok) {
      throw new Error(`Zenoti auth failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  // -----------------------------------------------------------------------
  // Core HTTP Method
  // -----------------------------------------------------------------------

  /**
   * Make an authenticated GET request to the Zenoti API.
   * Handles rate limiting, retries with exponential backoff on 429/5xx.
   *
   * @param path — API path (e.g., '/v1/centers/{id}/patients')
   * @param params — Query parameters
   * @returns Parsed JSON response
   */
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.rateLimiter.acquire();
    const token = await this.ensureToken();
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    for (let attempt = 0; attempt <= ZenotiClient.MAX_RETRIES; attempt++) {
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Success — return parsed body
      if (response.ok) {
        return (await response.json()) as T;
      }
      // Rate limited — respect Retry-After or backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffDelay(attempt);
        this.logger.warn(`Zenoti 429 rate limit, retrying in ${delay}ms (attempt ${attempt + 1})`);
        await sleep(delay);
        continue;
      }
      // Server error — retry with backoff
      if (response.status >= 500 && attempt < ZenotiClient.MAX_RETRIES) {
        const delay = backoffDelay(attempt);
        this.logger.warn(`Zenoti ${response.status}, retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      // Non-retryable error
      throw new Error(`Zenoti API error: ${response.status} ${await response.text()}`);
    }
    throw new Error(`Zenoti API: max retries (${ZenotiClient.MAX_RETRIES}) exceeded`);
  }

  // -----------------------------------------------------------------------
  // Paginated Fetcher
  // -----------------------------------------------------------------------

  /**
   * Fetch all pages of a paginated Zenoti endpoint.
   * Follows the `pagination.currentPage / totalPages` pattern.
   *
   * @param path — API path
   * @param dataKey — Key in response containing the record array
   * @param params — Additional query parameters
   * @returns All records across all pages
   */
  async fetchAllPages<T>(
    path: string,
    dataKey: string,
    params?: Record<string, string>
  ): Promise<T[]> {
    const allRecords: T[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const queryParams = { ...params, page: String(page), page_size: '100' };
      const response = await this.get<PaginatedResponse<T>>(path, queryParams);
      const records = (response[dataKey] ?? []) as T[];
      allRecords.push(...records);
      totalPages = response.pagination?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);

    return allRecords;
  }

  // -----------------------------------------------------------------------
  // Entity-Specific Fetch Methods (per API-EXTRACT-01 §2)
  // -----------------------------------------------------------------------

  /** Fetch patients for a center with optional incremental filter */
  async getPatients(centerId: string, updatedAfter?: string): Promise<PatientRecord[]> {
    const params: Record<string, string> = {};
    if (updatedAfter) params.updated_after = updatedAfter;
    return this.fetchAllPages<PatientRecord>(
      `/v1/centers/${centerId}/patients`, 'patients', params
    );
  }

  /** Fetch appointments for a center within a date range */
  async getAppointments(centerId: string, from: string, to: string): Promise<AppointmentRecord[]> {
    return this.fetchAllPages<AppointmentRecord>(
      `/v1/centers/${centerId}/appointments`, 'appointments',
      { from, to }
    );
  }

  /** Fetch services (master data) for a center */
  async getServices(centerId: string): Promise<ServiceRecord[]> {
    return this.fetchAllPages<ServiceRecord>(
      `/v1/centers/${centerId}/services`, 'services'
    );
  }

  /** Fetch payments for a center within a date range */
  async getPayments(centerId: string, from: string, to: string): Promise<PaymentRecord[]> {
    return this.fetchAllPages<PaymentRecord>(
      `/v1/centers/${centerId}/payments`, 'payments',
      { from, to }
    );
  }

  /** Fetch inventory items (products) for a center */
  async getInventoryItems(centerId: string): Promise<InventoryItemRecord[]> {
    return this.fetchAllPages<InventoryItemRecord>(
      `/v1/centers/${centerId}/products`, 'products'
    );
  }

  /** Fetch inventory lots for a center */
  async getInventoryLots(centerId: string): Promise<InventoryLotRecord[]> {
    return this.fetchAllPages<InventoryLotRecord>(
      `/v1/centers/${centerId}/inventory-lots`, 'lots'
    );
  }

  /** Fetch inventory usage for a center within a date range */
  async getInventoryUsage(centerId: string, from: string, to: string): Promise<InventoryUsageRecord[]> {
    return this.fetchAllPages<InventoryUsageRecord>(
      `/v1/centers/${centerId}/inventory-usage`, 'usages',
      { from, to }
    );
  }

  /** Fetch employees (providers) for a center */
  async getEmployees(centerId: string): Promise<EmployeeRecord[]> {
    return this.fetchAllPages<EmployeeRecord>(
      `/v1/centers/${centerId}/employees`, 'employees'
    );
  }

  /** Fetch rooms for a center */
  async getRooms(centerId: string): Promise<RoomRecord[]> {
    return this.fetchAllPages<RoomRecord>(
      `/v1/centers/${centerId}/rooms`, 'rooms'
    );
  }
}

// ---------------------------------------------------------------------------
// Zenoti API Record Types (from api-extraction-specification.md §2)
// ---------------------------------------------------------------------------

export interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  createdOn?: string;
  lastModifiedOn?: string;
  centerId: string;
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  providerId?: string;
  roomId?: string;
  startTime?: string;
  endTime?: string;
  status: string;
  services: AppointmentServiceRecord[];
  payments: AppointmentPaymentRecord[];
  noShow?: boolean;
  cancelReason?: string;
  centerId?: string;
}

export interface AppointmentServiceRecord {
  id: string;
  serviceId: string;
  providerId?: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
}

export interface AppointmentPaymentRecord {
  id: string;
  amount: number;
  tenderType: string;
}

export interface ServiceRecord {
  id: string;
  name: string;
  categoryId?: string;
  duration?: number;
  price?: number;
  isActive?: boolean;
}

export interface PaymentRecord {
  id: string;
  patientId: string;
  appointmentId?: string;
  packageId?: string;
  membershipId?: string;
  amount: number;
  tenderType: string;
  transactionDate?: string;
}

export interface InventoryItemRecord {
  id: string;
  sku?: string;
  name: string;
  manufacturer?: string;
  brandFamily?: string;
  productType: string;
  unitOfMeasure: string;
  unitsPerPackage?: number;
  defaultCost?: number;
  defaultPrice?: number;
  isActive?: boolean;
}

export interface InventoryLotRecord {
  id: string;
  productId: string;
  lotNumber: string;
  receivedDate?: string;
  expirationDate?: string;
  vendorId?: string;
  receivedQuantity: number;
  receivedUnitCost: number;
  quantityOnHand: number;
}

export interface InventoryUsageRecord {
  id: string;
  appointmentId?: string;
  productId: string;
  lotId?: string;
  usageDate?: string;
  quantityUsed: number;
  unitCost: number;
  extendedCost: number;
  treatmentArea?: string;
}

export interface EmployeeRecord {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: string;
  compensationModel?: string;
  commissionRate?: number;
  centerId: string;
  isActive?: boolean;
}

export interface RoomRecord {
  id: string;
  name: string;
  roomType?: string;
  centerId: string;
  isActive?: boolean;
}
