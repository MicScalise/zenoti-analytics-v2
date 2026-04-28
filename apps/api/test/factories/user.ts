// =============================================================================
// Test Factory — User (DD-31 §9.2 config_users)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { User } from '@za/shared';

let counter = 0;

/**
 * Build a User test fixture with sensible defaults.
 * All field names match DD-31 §9.2 column names exactly.
 */
export function buildUser(overrides: Partial<User> = {}): User {
  counter++;
  return {
    user_id: `10000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    email: `user${counter}@test.com`,
    password_hash: '$2b$10$testhash',
    role: 'staff',
    login_attempts: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
