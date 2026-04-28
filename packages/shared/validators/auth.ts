// =============================================================================
// Zod Validators — Auth request validation (DD-32 auth endpoints)
// Implements: EP §14 (validation at every step)
// ============================================================================

import { z } from 'zod';

/** Login request body — email + password */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Refresh token request body */
export const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

/** Change password request body */
export const changePasswordSchema = z.object({
  current_password: z.string().min(8),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});

/** Inferred types from schemas — single source of truth */
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
