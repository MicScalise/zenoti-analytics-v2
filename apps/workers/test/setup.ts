// =============================================================================
// Test Setup — Workers workspace (DR-007, DR-011)
// DR-007: Load test environment variables before any module reads them.
// DR-011: This is a setup file, not a test file — no test cases here.
// ============================================================================

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
