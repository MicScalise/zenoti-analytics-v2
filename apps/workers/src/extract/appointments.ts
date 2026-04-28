// =============================================================================
// Appointment Extraction Worker — Fetches appointments from Zenoti API
// Implements: TASK-024, REQ-EXT-01
// Design: api-extraction-specification.md §2.2
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
 * Extract appointments for all enabled centers within a date range.
 * Must run AFTER patients extraction (SF-01 ordering).
 *
 * @param db — Database pool
 * @param client — Zenoti API client
 * @param tenantId — Tenant UUID
 * @param from — ISO date start
 * @param to — ISO date end
 * @param logger — Structured logger
 */
export async function extractAppointments(
  db: Pool,
  client: ZenotiExtractor,
  tenantId: string,
  from: string,
  to: string,
  logger: Logger
): Promise<void> {
  const entityType: EntityType = 'appointments';
  const centers = await getEnabledCenters(db, tenantId);

  for (const center of centers) {
    const runId = await createExtractionRun(db, tenantId, center.location_id, entityType);

    try {
      const enabled = await isCenterEnabled(db, center.location_id);
      if (!enabled) {
        await skipExtractionRun(db, runId, tenantId, 'Center is disabled (G-4)');
        continue;
      }

      logger.info({ runId, centerId: center.zenoti_location_id }, 'Fetching appointments');
      const appointments = await client.getAppointments(
        center.zenoti_location_id, from, to
      );

      const filePath = `${RAW_DATA_DIR}/${tenantId}/${entityType}/${runId}/raw.jsonl`;
      const checksum = await writeRawJsonl(filePath, appointments);

      await completeExtractionRun(
        db, runId, tenantId, appointments.length, 0, filePath, checksum
      );

      logger.info(
        { runId, recordsFetched: appointments.length },
        'Appointment extraction completed'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failExtractionRun(db, runId, tenantId, message);
      logger.error({ runId, error: message }, 'Appointment extraction failed');
      throw error;
    }
  }
}
