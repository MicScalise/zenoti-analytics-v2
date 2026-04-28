// =============================================================================
// import { _uuidv4 as uuidv4, _bcrypt as bcrypt } from '../../lib/stubs.js';
// Inventory Lot Helpers — Lot management operations
// Implements: OP-LOT-01 through OP-LOT-03 (DD-36 §8.2)
// Extracted from inventory-service.ts per 150-line rule
// ============================================================================

import crypto from 'node:crypto';
import { pool, withTenantContext } from '../../db.js';
// import { v4 as uuidv4 } from 'uuid'; // Stubbed

/** Inventory lot response */
export interface InventoryLotResponse {
  lotId: string;
  lotNumber: string;
  receivedDate: string;
  expirationDate: string;
  receivedQuantity: number;
  quantityOnHand: number;
  receivedUnitCost: number;
  isExpired: boolean;
}

/**
 * Get available lots for an item (FIFO order, with row lock).
 * Implements OP-LOT-01. MUST be called within a transaction.
 *
 * @param client — transaction client for row locking
 * @param tenantId — tenant UUID
 * @param itemId — inventory item UUID
 * @returns lots ordered by expiration date (FIFO)
 */
export async function getAvailableLots(
  client: import('pg').PoolClient, tenantId: string, itemId: string
): Promise<InventoryLotResponse[]> {
  const { rows } = await client.query(
    `SELECT lot_id, lot_number, received_date, expiration_date,
      received_quantity, quantity_on_hand, received_unit_cost
    FROM dim_inventory_lots
    WHERE tenant_id = $1 AND item_id = $2 AND is_expired = false AND quantity_on_hand > 0
    ORDER BY expiration_date ASC FOR UPDATE;`,
    [tenantId, itemId]
  );
  return rows.map((r: Record<string, unknown>) => ({
    lotId: r.lot_id as string, lotNumber: r.lot_number as string,
    receivedDate: r.received_date as string, expirationDate: r.expiration_date as string,
    receivedQuantity: Number(r.received_quantity), quantityOnHand: Number(r.quantity_on_hand),
    receivedUnitCost: Number(r.received_unit_cost), isExpired: false,
  }));
}

/**
 * Decrement lot quantity after consumption.
 * Implements OP-LOT-02. MUST be called within same transaction as usage insert.
 *
 * @param client — transaction client
 * @param quantityUsed — amount to decrement
 * @param lotId — lot UUID
 * @param tenantId — tenant UUID
 * @returns new quantity_on_hand
 */
export async function decrementLotQuantity(
  client: import('pg').PoolClient, quantityUsed: number, lotId: string, tenantId: string
): Promise<number> {
  const { rows } = await client.query(
    `UPDATE dim_inventory_lots SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
     WHERE lot_id = $2 AND tenant_id = $3 AND is_expired = false
     RETURNING quantity_on_hand;`,
    [quantityUsed, lotId, tenantId]
  );
  if (rows.length === 0) throw new Error('Lot not found or expired');
  const newQty = Number(rows[0].quantity_on_hand);
  if (newQty < 0) throw new Error('Insufficient inventory (INVENTORY_INSUFFICIENT)');
  return newQty;
}

/**
 * Insert new lot (upon receipt).
 * Implements OP-LOT-03.
 *
 * @param tenantId — tenant UUID
 * @param userId — requesting user UUID
 * @param input — lot creation data
 * @returns created lot ID
 */
export async function createLot(
  tenantId: string, userId: string, input: {
    itemId: string; lotNumber: string; receivedDate: string;
    expirationDate: string; vendorId?: string;
    receivedQuantity: number; receivedUnitCost: number;
  }
): Promise<string> {
  const lotId = crypto.randomUUID();
  const result = await withTenantContext(tenantId, userId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO dim_inventory_lots (
        lot_id, tenant_id, item_id, lot_number, received_date, expiration_date,
        vendor_id, received_quantity, received_unit_cost, quantity_on_hand, is_expired,
        created_at, updated_at, created_by, loaded_by_program, loaded_by_version, source, source_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, false, NOW(), NOW(), $10, $11, $12, 'zenoti_api', $4)
      RETURNING lot_id;`,
      [lotId, tenantId, input.itemId, input.lotNumber, input.receivedDate,
       input.expirationDate, input.vendorId ?? null, input.receivedQuantity,
       input.receivedUnitCost, userId, 'api', '1.0.0']
    );
    return rows[0]?.lot_id;
  });

  // DR-020: Verify
  const verify = await pool.query(
    `SELECT lot_id FROM dim_inventory_lots WHERE lot_id = $1 AND tenant_id = $2;`,
    [result, tenantId]
  );
  if (verify.rows.length === 0) throw new Error('Lot creation verification failed');
  return result;
}
