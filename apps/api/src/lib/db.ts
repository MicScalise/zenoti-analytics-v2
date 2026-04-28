// =============================================================================
// DB — PostgreSQL connection pool (EP §15, DR-007)
// Implements: DR-007 (dotenv loads BEFORE all imports that use env vars)
// Connection pool for tenant-scoped queries with RLS context.
// ============================================================================

// DR-007: dotenv must load before any module that reads process.env
import 'dotenv/config';

import * as pg from 'pg';
const { Pool } = pg;

/** PostgreSQL connection pool — singleton per process */
let pool: pg.Pool | undefined;

/**
 * Get or create the PostgreSQL connection pool.
 * Uses DATABASE_URL from environment (set by dotenv).
 * Pool config optimized for PgBouncer transaction mode.
 *
 * @returns Configured pg.Pool instance
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: databaseUrl,
      // PgBouncer transaction-mode settings
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

/**
 * Set the tenant context for RLS on a client connection.
 * Must be called within a transaction before any business queries.
 *
 * @param client — Pg client from pool.connect()
 * @param tenantId — Current tenant UUID from auth context
 */
export async function setTenantContext(client: pg.PoolClient, tenantId: string): Promise<void> {
  await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
}

/**
 * Execute a query within tenant-scoped RLS context.
 * Opens a transaction, sets tenant_id, runs query, commits.
 *
 * @param tenantId — Tenant UUID for RLS
 * @param text — SQL query
 * @param params — Query parameters
 * @returns Query result
 */
export async function queryWithTenant<T extends pg.QueryResultRow>(
  tenantId: string,
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await setTenantContext(client, tenantId);
    const result = await client.query<T>(text, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the connection pool (for graceful shutdown).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
