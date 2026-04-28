// =============================================================================
// Test Setup — API workspace (DR-007, DR-011)
// Implements: DR-007 (dotenv loads before imports), DR-011 (setup file, not test)
// This file is referenced in jest.config.ts setupFilesAfterEnv.
// It runs BEFORE any test file — no test cases here.
// ============================================================================

// DR-007: Load test environment variables before any module reads them
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Extend Jest matchers if needed
// import '@types/jest';
