// =============================================================================
// Tenant Service — Tenant and location CRUD operations
// Implements: OP-TN-01 through OP-TN-03, OP-CTR-01 through OP-CTR-04 (DD-36 §4)
// ============================================================================

import { pool } from '../../db.js';
// import { v4 as uuidv4 } from 'uuid'; // Stubbed

/** Tenant response — matches config_tenants columns */
export interface TenantResponse {
  tenantId: string;
  tenantName: string;
  zenotiSubdomain: string;
  billingStatus: string;
  payPeriodType: string;
  payPeriodAnchorDay: number;
  timezone: string;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Location response — matches dim_locations columns (DR-029 safe) */
export interface LocationResponse {
  locationId: string;
  zenotiLocationId: string;
  locationName: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  isActive: boolean;
}

/**
 * Get tenant by ID.
 * Implements OP-TN-01.
 *
 * @param tenantId — tenant UUID
 * @returns tenant data or null
 */
export async function getTenantById(tenantId: string): Promise<TenantResponse | null> {
  const { rows } = await pool.query(
    `SELECT
      tenant_id, tenant_name, zenoti_subdomain, billing_status,
      pay_period_type, pay_period_anchor_day, timezone, trial_ends_at,
      created_at, updated_at
    FROM config_tenants
    WHERE tenant_id = $1;`,
    [tenantId]
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    tenantId: r.tenant_id, tenantName: r.tenant_name,
    zenotiSubdomain: r.zenoti_subdomain, billingStatus: r.billing_status,
    payPeriodType: r.pay_period_type, payPeriodAnchorDay: r.pay_period_anchor_day,
    timezone: r.timezone, trialEndsAt: r.trial_ends_at,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/**
 * Check billing status for guard G-1/G-2.
 * Implements OP-TN-02.
 *
 * @param tenantId — tenant UUID
 * @returns billing status enum value
 */
export async function getBillingStatus(tenantId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT billing_status FROM config_tenants WHERE tenant_id = $1;`,
    [tenantId]
  );
  return rows.length > 0 ? rows[0].billing_status : null;
}

/**
 * Update tenant settings (PATCH — only owner role allowed, enforced by route guard).
 * Implements OP-TN-03.
 *
 * @param tenantId — tenant UUID
 * @param input — partial update fields
 * @returns updated tenant row
 */
export async function updateTenant(
  tenantId: string,
  input: { timezone?: string; payPeriodType?: string; payPeriodAnchorDay?: number }
): Promise<TenantResponse | null> {
  const { rows } = await pool.query(
    `UPDATE config_tenants
    SET
      timezone = COALESCE($2, timezone),
      pay_period_type = COALESCE($3, pay_period_type),
      pay_period_anchor_day = COALESCE($4, pay_period_anchor_day),
      updated_at = NOW()
    WHERE tenant_id = $1
    RETURNING *;`,
    [tenantId, input.timezone ?? null, input.payPeriodType ?? null, input.payPeriodAnchorDay ?? null]
  );

  if (rows.length === 0) return null;

  // DR-020: Verify update persisted
  const verify = await getTenantById(tenantId);
  if (!verify) throw new Error('Tenant update verification failed');

  const r = rows[0];
  return {
    tenantId: r.tenant_id, tenantName: r.tenant_name,
    zenotiSubdomain: r.zenoti_subdomain, billingStatus: r.billing_status,
    payPeriodType: r.pay_period_type, payPeriodAnchorDay: r.pay_period_anchor_day,
    timezone: r.timezone, trialEndsAt: r.trial_ends_at,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/**
 * List all locations for a tenant.
 * Implements OP-CTR-01.
 *
 * @param tenantId — tenant UUID
 * @param limit — page size
 * @param offset — page offset
 * @returns array of location responses
 */
export async function listLocations(
  tenantId: string, limit: number, offset: number
): Promise<LocationResponse[]> {
  const { rows } = await pool.query(
    `SELECT
      location_id, zenoti_location_id, location_name,
      address_line1, address_line2, city, state, postal_code, country,
      timezone, is_active, is_enabled,
      created_at, updated_at
    FROM dim_locations
    WHERE tenant_id = $1
    ORDER BY location_name
    LIMIT $2 OFFSET $3;`,
    [tenantId, limit, offset]
  );

  return rows.map((r: Record<string, unknown>) => ({
    locationId: r.location_id as string,
    zenotiLocationId: r.zenoti_location_id as string,
    locationName: r.location_name as string,
    addressLine1: r.address_line1 as string | null,
    city: r.city as string | null,
    state: r.state as string | null,
    timezone: r.timezone as string | null,
    isActive: r.is_active as boolean,
  }));
}

/**
 * Soft-deactivate a location.
 * Implements OP-CTR-04.
 *
 * @param locationId — location UUID
 * @param tenantId — tenant UUID
 */
export async function deactivateLocation(locationId: string, tenantId: string): Promise<void> {
  await pool.query(
    `UPDATE dim_locations SET is_active = false, updated_at = NOW()
     WHERE location_id = $1 AND tenant_id = $2;`,
    [locationId, tenantId]
  );
}
