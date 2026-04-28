// =============================================================================
// Identity Module — Public API
// Implements: TASK-015 (module barrel export)
// Exports router for mounting and services for cross-module use.
// ============================================================================

export { identityRouter } from './routes.js';
export { authenticateUser, verifyMfa, generateSessionToken, generateRefreshToken } from './services/auth-service.js';
export { createUser, updateUser, getUserById } from './services/user-service.js';
export type { UserResponse, CreateUserInput, UpdateUserInput } from './services/user-service.js';
