// =============================================================================
// Workers Entry Point — BullMQ job processor for extraction and load pipelines
// Implements: TASK-024, REQ-EXT-01, REQ-EXT-02
// Design: api-extraction-specification.md §3–5, 34-sequence-flows.md §2 (SF-01)
// Defect Registry: DR-007 (dotenv before all imports)
// =============================================================================

// DR-007: dotenv MUST load before any module that reads env vars
import 'dotenv/config';

import { Worker } from 'bullmq';
import { Pool } from 'pg';
import pino from 'pino';
import type { ZenotiExtractor } from '@za/shared/types';
import { extractPatients } from './extract/patients.js';
import { extractAppointments } from './extract/appointments.js';
import { extractSales } from './extract/sales.js';
import { extractInventory } from './extract/inventory.js';
import { extractProviders } from './extract/providers.js';
import { extractServices } from './extract/services.js';
import { extractRooms } from './extract/rooms.js';
import { loadPatients } from './load/patients.js';
import { loadAppointments } from './load/appointments.js';
import { loadSales } from './load/sales.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const redisOpts = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
};

// ---------------------------------------------------------------------------
// Zenoti Client Factory — resolves client from API package at runtime
// ---------------------------------------------------------------------------

/** Factory function type for creating ZenotiExtractor instances */
export type ZenotiClientFactory = (apiKey: string, subdomain: string, log: pino.Logger) => ZenotiExtractor;

/** Default factory — dynamically loads ZenotiClient from the API package */
let clientFactory: ZenotiClientFactory | null = null;

/**
 * Set the ZenotiClient factory. Called by the application bootstrap
 * to inject the concrete client implementation.
 *
 * @param factory — Function that creates a ZenotiExtractor instance
 */
export function setZenotiClientFactory(factory: ZenotiClientFactory): void {
  clientFactory = factory;
}

/**
 * Get or create a ZenotiExtractor using the registered factory.
 * Falls back to a dynamic import of the API package if no factory is set.
 */
async function createZenotiClient(apiKey: string, subdomain: string, log: pino.Logger): Promise<ZenotiExtractor> {
  if (clientFactory) {
    return clientFactory(apiKey, subdomain, log);
  }
  // Fallback: dynamic require (works in CJS runtime, avoids rootDir at compile time)
  throw new Error(
    'ZenotiClient factory not configured. Call setZenotiClientFactory() at startup.'
  );
}

// ---------------------------------------------------------------------------
// Extraction Job Handler
// ---------------------------------------------------------------------------

/**
 * Process an extraction job. Enforces SF-01 mandatory ordering.
 * Each job extracts data from Zenoti API and writes raw.jsonl (DR-043).
 */
async function processExtractionJob(job: {
  name: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const { tenantId, entityType, from, to, updatedAfter } = job.data;
  const tid = tenantId as string;
  const log = logger.child({ tenantId: tid, entityType });

  // Look up Zenoti API credentials for this tenant
  const conn = await db.connect();
  let apiKey: string;
  let subdomain: string;
  try {
    await conn.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tid]);
    const tenantRow = await conn.query(
      'SELECT zenoti_api_key, zenoti_subdomain FROM config_tenants WHERE tenant_id = $1',
      [tid]
    );
    if (tenantRow.rows.length === 0) {
      throw new Error(`Tenant ${tid} not found`);
    }
    apiKey = tenantRow.rows[0].zenoti_api_key;
    subdomain = tenantRow.rows[0].zenoti_subdomain;
  } finally {
    conn.release();
  }

  const client = await createZenotiClient(apiKey, subdomain, log);

  switch (entityType) {
    case 'patients':
      await extractPatients(db, client, tid, log, updatedAfter as string | undefined);
      break;
    case 'appointments':
      await extractAppointments(db, client, tid, from as string, to as string, log);
      break;
    case 'sales':
      await extractSales(db, client, tid, from as string, to as string, log);
      break;
    case 'inventory':
      await extractInventory(db, client, tid, from as string, to as string, log);
      break;
    case 'providers':
      await extractProviders(db, client, tid, log);
      break;
    case 'services':
      await extractServices(db, client, tid, log);
      break;
    case 'rooms':
      await extractRooms(db, client, tid, log);
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

// ---------------------------------------------------------------------------
// Load Job Handler
// ---------------------------------------------------------------------------

/**
 * Process a load job. Calls stored procedures only (DR-043).
 */
async function processLoadJob(job: {
  name: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const { tenantId, extractionRunId, entityType } = job.data;
  const tid = tenantId as string;
  const log = logger.child({ tenantId: tid, entityType, extractionRunId });

  const conn = await db.connect();
  try {
    await conn.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tid]);

    switch (entityType) {
      case 'patients':
        await loadPatients(db, tid, extractionRunId as string, log);
        break;
      case 'appointments':
        await loadAppointments(db, tid, extractionRunId as string, log);
        break;
      case 'sales':
        await loadSales(db, tid, extractionRunId as string, log);
        break;
      default:
        throw new Error(`Unknown entity type for load: ${entityType}`);
    }
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// Start Workers
// ---------------------------------------------------------------------------

const extractionWorker = new Worker('extraction', processExtractionJob as never, {
  connection: redisOpts,
  concurrency: 1,
});

const loadWorker = new Worker('load', processLoadJob as never, {
  connection: redisOpts,
  concurrency: 3,
});

extractionWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Extraction job failed');
});

loadWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Load job failed');
});

logger.info('Workers started — listening for extraction and load jobs');
