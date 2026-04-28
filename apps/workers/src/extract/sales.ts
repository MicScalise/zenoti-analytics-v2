// =============================================================================
// Sales Extraction Worker — Fetches sales/invoices from Zenoti API
// Implements: TASK-024, REQ-EXT-01
// Design: api-extraction-specification.md §2.4
// Defect Registry: DR-043 (writes raw.jsonl only)
// =============================================================================

import type { Pool } from 'pg';
import type { Logger } from 'pino';
import type { ZenotiExtractor } from './extraction-utils.js';
import {
  createExtractionRun,
  completeExtractionRun,
  failExtractionRun,
  skipExtractionRun,
  writeRawJsonl,
  isCenterEnabled,
  getEnabledCenters,
  type EntityType,
} from './extraction-utils.js';

const RAW_DATA_DIR = process.env.RAW_DATA_DIR ?? '/tmp/zenoti-extractions';

/**
 * Extract sales for all enabled centers within a date range.
 * Must run AFTER appointments extraction (SF-01 ordering).
 */
export async function extractSales(
  db: Pool,
  client: ZenotiExtractor,
  tenantId: string,
  from: string,
  to: string,
  logger: Logger
): Promise<void> {
  const entityType: EntityType = 'sales';
  const centers = await getEnabledCenters(db, tenantId);

  for (const center of centers) {
    const runId = await createExtractionRun(db, tenantId, center.location_id, entityType);

    try {
      const enabled = await isCenterEnabled(db, center.location_id);
      if (!enabled) {
        await skipExtractionRun(db, runId, tenantId, 'Center is disabled (G-4)');
        continue;
      }

      logger.info({ runId, centerId: center.zenoti_location_id }, 'Fetching sales');
      const sales = await client.getPayments(center.zenoti_location_id, from, to);

      const filePath = `${RAW_DATA_DIR}/${tenantId}/${entityType}/${runId}/raw.jsonl`;
      const checksum = await writeRawJsonl(filePath, sales);

      await completeExtractionRun(
        db, runId, tenantId, sales.length, 0, filePath, checksum
      );

      logger.info(
        { runId, recordsFetched: sales.length },
        'Sales extraction completed'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failExtractionRun(db, runId, tenantId, message);
      logger.error({ runId, error: message }, 'Sales extraction failed');
      throw error;
    }
  }
}
