// =============================================================================
// Express Type Augmentation — Adds req.user type for authenticated requests
// Implements: TASK-027, NFR-SEC-01
// Design: 35-security-and-observability.md §3
// Defect Registry: DR-037 (no (req as any) casts — use express.d.ts)
// =============================================================================

import type { UserSession } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user context set by auth middleware */
      user?: UserSession;
    }
  }
}

export {}; // Ensure this is treated as a module
