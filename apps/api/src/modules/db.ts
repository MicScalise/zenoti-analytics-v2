// =============================================================================
// Database Pool — singleton pg Pool for all services
// Implements: DR-007 (dotenv loads BEFORE all imports)
// ============================================================================

// DR-007: dotenv must load before pg Pool reads env vars
import 'dotenv/config';
import { Pool, PoolConfig } from 'pg';

/** Pool configuration sourced from environment */
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection limits for PgBouncer compatibility
  max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

/** Singleton pool — shared across all service modules */
export const pool = new Pool(poolConfig);

/**
 * Run a callback inside a transaction with tenant RLS context set.
 * Every service that modifies data should use this wrapper.
 *
 * @param tenantId — UUID of the current tenant (from req.user.tid)
 * @param userId — UUID of the current user (from req.user.uid)
 * @param fn — callback receiving the pg Client for the transaction
 * @returns whatever fn returns
 */
export async function withTenantContext<T>(
  tenantId: string,
  userId: string,
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // OP-CONTEXT-01: Set RLS tenant context
    await client.query("SELECT set_config('app.tenant_id', $1::text, true)", [tenantId]);
    await client.query("SELECT set_config('app.user_id', $1::text, true)", [userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
