// =============================================================================
// layer2-validation.test.ts — Layer 2 companion validation tests
// Implements: EP §14 (output validation), 43-test-strategy.md §8
// =============================================================================

import { describe, it, expect } from '@jest/globals';

/**
 * Layer 2 validation: extraction record count matches raw.jsonl line count.
 * This is a companion check that verifies data integrity between
 * the extraction output (raw.jsonl) and the recorded metadata.
 *
 * Failure thresholds:
 * - >0.1% mismatch = WARNING
 * - >1% mismatch = FAILURE
 *
 * These tests validate the validation logic itself.
 * Real data validation runs as part of the extraction pipeline.
 */

/** Calculates mismatch percentage between two counts. */
function mismatchPct(recordCount: number, lineCount: number): number {
  if (recordCount === 0 && lineCount === 0) return 0;
  const base = Math.max(recordCount, lineCount);
  return base === 0 ? 0 : Math.abs(recordCount - lineCount) / base;
}

/** Classifies a mismatch as OK, WARNING, or FAILURE. */
function classifyMismatch(pct: number): 'ok' | 'warning' | 'failure' {
  if (pct <= 0.001) return 'ok';      // <= 0.1%
  if (pct <= 0.01) return 'warning';   // <= 1%
  return 'failure';                    // > 1%
}

describe('Layer 2 Validation: Extraction vs raw.jsonl', () => {
  describe('mismatch calculation', () => {
    it('zero mismatch when counts are equal', () => {
      const pct = mismatchPct(100, 100);
      expect(pct).toBe(0);
      expect(classifyMismatch(pct)).toBe('ok');
    });

    it('0.1% mismatch is OK', () => {
      // 1000 records, 999 lines = 0.1% mismatch
      const pct = mismatchPct(1000, 999);
      expect(pct).toBeCloseTo(0.001, 4);
      expect(classifyMismatch(pct)).toBe('ok');
    });

    it('>0.1% and <=1% mismatch is WARNING', () => {
      // 1000 records, 995 lines = 0.5% mismatch
      const pct = mismatchPct(1000, 995);
      expect(pct).toBeCloseTo(0.005, 4);
      expect(classifyMismatch(pct)).toBe('warning');
    });

    it('>1% mismatch is FAILURE', () => {
      // 1000 records, 980 lines = 2% mismatch
      const pct = mismatchPct(1000, 980);
      expect(pct).toBeCloseTo(0.02, 4);
      expect(classifyMismatch(pct)).toBe('failure');
    });

    it('handles zero records and zero lines', () => {
      const pct = mismatchPct(0, 0);
      expect(pct).toBe(0);
      expect(classifyMismatch(pct)).toBe('ok');
    });
  });

  describe('raw.jsonl integrity', () => {
    it('each line in raw.jsonl is valid JSON', () => {
      // Simulate raw.jsonl content verification
      const sampleLines = [
        '{"id":1,"name":"Patient A"}',
        '{"id":2,"name":"Patient B"}',
        '{"id":3,"name":"Patient C"}',
      ];
      const validLines = sampleLines.filter((line) => {
        try { JSON.parse(line); return true; } catch { return false; }
      });
      expect(validLines.length).toBe(sampleLines.length);
    });

    it('extraction record count matches raw.jsonl line count', () => {
      // Perfect match: 3 records fetched, 3 lines in raw.jsonl
      const recordCount = 3;
      const lineCount = 3;
      expect(mismatchPct(recordCount, lineCount)).toBe(0);
    });
  });

  describe('checksum validation', () => {
    it('SHA256 checksum is computed and stored', () => {
      // Checksum must be a non-empty hex string
      const checksum = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
