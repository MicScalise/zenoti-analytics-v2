// =============================================================================
// DB Schema — Config table type exports (DD-31 §9)
// Implements: EP §8 (single source of truth), EP §15 (dependencies flow down)
// Types mirror DD-31 column names exactly for use in queries.
// ============================================================================

import type {
  Tenant,
  User,
  TenantBillingStatus,
  UserRole,
} from '@za/shared';

/** Config table row types for typed query results */
export type ConfigTenantRow = Tenant;
export type ConfigUserRow = Omit<User, 'password_hash'>;

/** Insert params for config_tenants — matches DD-31 §9.1 columns */
export interface InsertTenantParams {
  tenant_name: string;
  zenoti_api_key: string;
  zenoti_subdomain: string;
  pay_period_type: 'weekly' | 'biweekly';
  pay_period_anchor_day: number;
  timezone?: string;
  billing_status?: TenantBillingStatus;
}

/** Insert params for config_users — matches DD-31 §9.2 columns */
export interface InsertUserParams {
  tenant_id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  mfa_secret_encrypted?: string;
  is_active?: boolean;
}

/** Update params for config_users — all fields optional */
export interface UpdateUserParams {
  email?: string;
  password_hash?: string;
  role?: UserRole;
  mfa_secret_encrypted?: string;
  login_attempts?: number;
  locked_until?: string;
  last_login_at?: string;
  last_login_ip?: string;
  is_active?: boolean;
}
