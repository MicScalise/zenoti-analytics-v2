// =============================================================================
// Room Extraction Worker — Fetches rooms from Zenoti API
// Implements: TASK-024, REQ-EXT-01
// Design: api-extraction-specification.md §2.13
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
 * Extract rooms for all enabled centers.
 * Can run in parallel with services extraction.
 */
export async function extractRooms(
  db: Pool,
  client: ZenotiExtractor,
  tenantId: string,
  logger: Logger
): Promise<void> {
  const entityType: EntityType = 'rooms';
  const centers = await getEnabledCenters(db, tenantId);

  for (const center of centers) {
    const runId = await createExtractionRun(db, tenantId, center.location_id, entityType);

    try {
      const enabled = await isCenterEnabled(db, center.location_id);
      if (!enabled) {
        await skipExtractionRun(db, runId, tenantId, 'Center is disabled (G-4)');
        continue;
      }

      logger.info({ runId, centerId: center.zenoti_location_id }, 'Fetching rooms');
      const rooms = await client.getRooms(center.zenoti_location_id);

      const filePath = `${RAW_DATA_DIR}/${tenantId}/${entityType}/${runId}/raw.jsonl`;
      const checksum = await writeRawJsonl(filePath, rooms);

      await completeExtractionRun(
        db, runId, tenantId, rooms.length, 0, filePath, checksum
      );

      logger.info(
        { runId, recordsFetched: rooms.length },
        'Room extraction completed'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failExtractionRun(db, runId, tenantId, message);
      logger.error({ runId, error: message }, 'Room extraction failed');
      throw error;
    }
  }
}
