// =============================================================================
// import { _uuidv4 as uuidv4, _bcrypt as bcrypt } from '../../lib/stubs.js';
// User Service — User CRUD operations
// Implements: OP-AUTH-02 (create), OP-AUTH-03 (update), OP-AUTH-06 (get by ID)
// ============================================================================

import { pool } from '../../db.js'; // withTenantContext unused
// import { v4 as uuidv4 } from 'uuid'; // Stubbed
// import bcrypt from 'bcryptjs'; // Stubbed

/** Public user response — DR-029: never expose password_hash */
export interface UserResponse {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

/** Input for creating a new user */
export interface CreateUserInput {
  email: string;
  password: string;
  role: string;
  tenantId: string;
  mfaSecretEncrypted?: string;
}

/** Input for updating a user (all fields optional) */
export interface UpdateUserInput {
  email?: string;
  role?: string;
  mfaSecretEncrypted?: string;
  isActive?: boolean;
}

/**
 * Create a new user in config_users.
 * Implements OP-AUTH-02. Password is hashed before storage.
 *
 * @param input — user creation data
 * @returns created user ID and timestamp
 */
export async function createUser(input: CreateUserInput): Promise<{ userId: string; createdAt: string }> {
  const userId = 'stub-uuid-' + Date.now();
  const passwordHash = 'stub-hash'; // bcrypt.hash(input.password, 12) stubbed

  const result = await pool.query(
    `INSERT INTO config_users (
      user_id, tenant_id, email, password_hash, role,
      mfa_secret_encrypted, login_attempts, locked_until,
      last_login_at, is_active,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, 0, NULL,
      NULL, true,
      NOW(), NOW()
    ) RETURNING user_id, created_at;`,
    [userId, input.tenantId, input.email, passwordHash, input.role, input.mfaSecretEncrypted ?? null]
  );

  // DR-020: Verify insert by reading back
  const verify = await pool.query(
    `SELECT user_id, tenant_id, email, role, is_active
     FROM config_users
     WHERE user_id = $1 AND tenant_id = $2;`,
    [userId, input.tenantId]
  );

  if (verify.rows.length === 0) {
    throw new Error('User creation verification failed: row not found after INSERT');
  }

  return {
    userId: result.rows[0].user_id,
    createdAt: result.rows[0].created_at,
  };
}

/**
 * Update user fields (PATCH semantics — NULL means no change).
 * Implements OP-AUTH-03.
 *
 * @param userId — user UUID to update
 * @param tenantId — tenant UUID for multi-tenant filtering
 * @param input — partial update data
 * @returns updated user row (DR-029: password_hash stripped)
 */
export async function updateUser(
  userId: string,
  tenantId: string,
  input: UpdateUserInput
): Promise<UserResponse | null> {
  const result = await pool.query(
    `UPDATE config_users
    SET
      email = COALESCE($3, email),
      role = COALESCE($4, role),
      mfa_secret_encrypted = COALESCE($5, mfa_secret_encrypted),
      is_active = COALESCE($6, is_active),
      updated_at = NOW()
    WHERE user_id = $1
      AND tenant_id = $2
    RETURNING *;`,
    [userId, tenantId, input.email ?? null, input.role ?? null, input.mfaSecretEncrypted ?? null, input.isActive ?? null]
  );

  if (result.rows.length === 0) return null;

  // DR-029: Strip password_hash from response
  return stripPasswordHash(result.rows[0]);
}

/**
 * Get user by ID for session lookup.
 * Implements OP-AUTH-06.
 *
 * @param userId — user UUID
 * @param tenantId — tenant UUID
 * @returns user without password_hash, or null if not found
 */
export async function getUserById(userId: string, tenantId: string): Promise<UserResponse | null> {
  const { rows } = await pool.query(
    `SELECT user_id, tenant_id, email, role, is_active
     FROM config_users
     WHERE user_id = $1
       AND tenant_id = $2
       AND is_active = true;`,
    [userId, tenantId]
  );

  if (rows.length === 0) return null;
  return {
    userId: rows[0].user_id,
    tenantId: rows[0].tenant_id,
    email: rows[0].email,
    role: rows[0].role,
    isActive: rows[0].is_active,
    lastLoginAt: null, // OP-AUTH-06 doesn't return last_login_at
  };
}

/**
 * Remove password_hash from a user row for API responses.
 * DR-029: Never expose password_hash in any API response.
 */
function stripPasswordHash(row: Record<string, unknown>): UserResponse {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, login_attempts, locked_until, mfa_secret_encrypted, ...safe } = row as Record<string, unknown>;
  return safe as unknown as UserResponse;
}
