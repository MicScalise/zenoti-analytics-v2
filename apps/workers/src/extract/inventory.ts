// =============================================================================
// Inventory Extraction Worker — Fetches inventory data from Zenoti API
// Implements: TASK-024, REQ-EXT-01
// Design: api-extraction-specification.md §2.5–2.7
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
 * Extract inventory items for all enabled centers.
 * Items are master data (no date range required).
 */
async function extractInventoryItems(
  db: Pool,
  client: ZenotiExtractor,
  tenantId: string,
  center: { location_id: string; zenoti_location_id: string },
  logger: Logger
): Promise<void> {
  const entityType: EntityType = 'inventory_items';
  const runId = await createExtractionRun(db, tenantId, center.location_id, entityType);

  try {
    const enabled = await isCenterEnabled(db, center.location_id);
    if (!enabled) {
      await skipExtractionRun(db, runId, tenantId, 'Center is disabled (G-4)');
      return;
    }

    logger.info({ runId, centerId: center.zenoti_location_id }, 'Fetching inventory items');
    const items = await client.getInventoryItems(center.zenoti_location_id);

    const filePath = `${RAW_DATA_DIR}/${tenantId}/${entityType}/${runId}/raw.jsonl`;
    const checksum = await writeRawJsonl(filePath, items);

    await completeExtractionRun(
      db, runId, tenantId, items.length, 0, filePath, checksum
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failExtractionRun(db, runId, tenantId, message);
    logger.error({ runId, error: message }, 'Inventory items extraction failed');
    throw error;
  }
}

/**
 * Extract inventory lots for all enabled centers within a date range.
 */
async function extractInventoryLots(
  db: Pool,
  client: ZenotiExtractor,
  tenantId: string,
  center: { location_id: string; zenoti_location_id: string },
  _from: string,
  _to: string,
  logger: Logger
): Promise<void> {
  const entityType: EntityType = 'inventory_lots';
  const runId = await createExtractionRun(db, tenantId, center.location_id, entityType);

  try {
    const enabled = await isCenterEnabled(db, center.location_id);
    if (!enabled) {
      await skipExtractionRun(db, runId, tenantId, 'Center is disabled (G-4)');
      return;
    }

    logger.info({ runId, centerId: center.zenoti_location_id }, 'Fetching inventory lots');
    const lots = await client.getInventoryLots(center.zenoti_location_id);

    const filePath = `${RAW_DATA_DIR}/${tenantId}/${entityType}/${runId}/raw.jsonl`;
    const checksum = await writeRawJsonl(filePath, lots);

    await completeExtractionRun(
      db, runId, tenantId, lots.length, 0, filePath, checksum
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failExtractionRun(db, runId, tenantId, message);
    logger.error({ runId, error: message }, 'Inventory lots extraction failed');
    throw error;
  }
}

/**
 * Extract all inventory data (items + lots) for all enabled centers.
 * Must run AFTER sales extraction (SF-01 ordering).
 */
export async function extractInventory(
  db: Pool,
  client: ZenotiExtractor,
  tenantId: string,
  _from: string,
  _to: string,
  logger: Logger
): Promise<void> {
  const centers = await getEnabledCenters(db, tenantId);

  for (const center of centers) {
    // Items first (master data), then lots (transactional data)
    await extractInventoryItems(db, client, tenantId, center, logger);
    await extractInventoryLots(db, client, tenantId, center, _from, _to, logger);
  }
}
