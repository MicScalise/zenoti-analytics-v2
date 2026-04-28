// =============================================================================
// Patient Extraction Worker — Fetches patients from Zenoti API
// Implements: TASK-024, REQ-EXT-01
// Design: api-extraction-specification.md §2.1
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
 * Extract patients for all enabled centers.
 * First entity in SF-01 mandatory ordering.
 * Supports incremental extraction via updatedAfter parameter.
 *
 * @param db — Database pool
 * @param client — Zenoti API client implementing ZenotiExtractor
 * @param tenantId — Tenant UUID
 * @param logger — Structured logger
 * @param updatedAfter — ISO timestamp for incremental extraction
 */
export async function extractPatients(
  db: Pool,
  client: ZenotiExtractor,
  tenantId: string,
  logger: Logger,
  updatedAfter?: string
): Promise<void> {
  const entityType: EntityType = 'patients';
  const centers = await getEnabledCenters(db, tenantId);

  for (const center of centers) {
    const runId = await createExtractionRun(db, tenantId, center.location_id, entityType);

    try {
      const enabled = await isCenterEnabled(db, center.location_id);
      if (!enabled) {
        await skipExtractionRun(db, runId, tenantId, 'Center is disabled (G-4)');
        continue;
      }

      logger.info({ runId, centerId: center.zenoti_location_id }, 'Fetching patients');
      const patients = await client.getPatients(
        center.zenoti_location_id, updatedAfter
      );

      const filePath = `${RAW_DATA_DIR}/${tenantId}/${entityType}/${runId}/raw.jsonl`;
      const checksum = await writeRawJsonl(filePath, patients);

      await completeExtractionRun(
        db, runId, tenantId, patients.length, 0, filePath, checksum
      );

      logger.info(
        { runId, recordsFetched: patients.length },
        'Patient extraction completed'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failExtractionRun(db, runId, tenantId, message);
      logger.error({ runId, error: message }, 'Patient extraction failed');
      throw error;
    }
  }
}
