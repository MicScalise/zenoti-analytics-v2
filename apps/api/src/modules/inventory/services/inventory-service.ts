// =============================================================================
// import { _uuidv4 as uuidv4, _bcrypt as bcrypt } from '../../lib/stubs.js';
// Inventory Service — Items and usage tracking (lot ops in inventory-lots.ts)
// Implements: OP-INV-01, OP-INV-02, OP-USAGE-01, OP-USAGE-02 (DD-36 §8)
// ============================================================================

import { pool, withTenantContext } from '../../db.js';
// import { v4 as uuidv4 } from 'uuid'; // Stubbed
import { getAvailableLots, decrementLotQuantity } from './inventory-lots.js';

/** Inventory item response */
export interface InventoryItemResponse {
  itemId: string;
  zenotiProductId: string;
  productName: string;
  manufacturer: string | null;
  brandFamily: string | null;
  productType: string;
  unitOfMeasure: string;
  unitsPerPackage: number | null;
  defaultCost: number | null;
  defaultPrice: number | null;
}

/** Inventory usage response */
export interface InventoryUsageResponse {
  usageId: string;
  usageDate: string;
  quantityUsed: number;
  unitCost: number;
  extendedCost: number;
  treatmentArea: string | null;
  productName: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  lotNumber: string | null;
}

// Re-export lot types and functions
export { createLot } from './inventory-lots.js';
export type { InventoryLotResponse } from './inventory-lots.js';

/**
 * Get active inventory items (catalog).
 * Implements OP-INV-02.
 */
export async function listActiveItems(tenantId: string): Promise<InventoryItemResponse[]> {
  const { rows } = await pool.query(
    `SELECT item_id, zenoti_product_id, product_name, manufacturer, brand_family,
      product_type, unit_of_measure, units_per_package, default_cost, default_price
    FROM dim_inventory_items
    WHERE tenant_id = $1 AND is_active = true AND effective_end = '2100-12-31'::DATE
    ORDER BY brand_family, product_name;`,
    [tenantId]
  );
  return rows.map(mapItemRow);
}

/**
 * Get item by Zenoti product ID (current version).
 * Implements OP-INV-01.
 */
export async function getItemByZenotiId(tenantId: string, zenotiProductId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT item_id FROM dim_inventory_items
     WHERE tenant_id = $1 AND zenoti_product_id = $2 AND effective_end = '2100-12-31'::DATE;`,
    [tenantId, zenotiProductId]
  );
  return rows.length > 0 ? rows[0].item_id : null;
}

/**
 * Record inventory usage with FIFO lot allocation.
 * Implements OP-USAGE-01. Uses OP-LOT-01 + OP-LOT-02 for lot management.
 */
export async function recordUsage(
  tenantId: string, userId: string, input: {
    visitServiceId: string; inventoryItemId: string;
    usageDate: string; quantityUsed: number; unitCostAtTime: number;
    extendedCost: number; treatmentArea?: string;
  }
): Promise<string> {
  const usageId = 'stub-uuid-' + Date.now();
  return withTenantContext(tenantId, userId, async (client) => {
    // Get available lots (FIFO, locked)
    const lots = await getAvailableLots(client, tenantId, input.inventoryItemId);
    if (lots.length === 0) {
      throw new Error('No available lots for item (INVENTORY_INSUFFICIENT)');
    }
    const lot = lots[0];
    if (lot.quantityOnHand < input.quantityUsed) {
      throw new Error('Insufficient quantity in lot (INVENTORY_INSUFFICIENT)');
    }

    // Decrement lot (OP-LOT-02)
    await decrementLotQuantity(client, input.quantityUsed, lot.lotId, tenantId);

    // Insert usage record (OP-USAGE-01)
    const { rows } = await client.query(
      `INSERT INTO fct_inventory_usage (
        usage_id, tenant_id, zenoti_usage_id, visit_service_id, lot_id, inventory_item_id,
        usage_date, quantity_used, unit_cost_at_time, extended_cost, treatment_area, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING usage_id;`,
      [usageId, tenantId, null, input.visitServiceId, lot.lotId,
       input.inventoryItemId, input.usageDate, input.quantityUsed,
       input.unitCostAtTime, input.extendedCost, input.treatmentArea ?? null]
    );
    return rows[0]?.usage_id;
  });
}

/**
 * Get usage records by lot (recall investigation).
 * Implements OP-USAGE-02.
 */
export async function getUsageByLot(lotId: string, tenantId: string): Promise<InventoryUsageResponse[]> {
  const { rows } = await pool.query(
    `SELECT u.usage_id, u.usage_date, u.quantity_used, u.treatment_area, u.extended_cost,
      vs.visit_id, vs.service_id, p.first_name, p.last_name
    FROM fct_inventory_usage u
    JOIN fct_visit_services vs ON u.visit_service_id = vs.visit_service_id
    JOIN fct_visits v ON vs.visit_id = v.visit_id
    JOIN dim_patients p ON v.patient_id = p.patient_id
    WHERE u.lot_id = $1 AND u.tenant_id = $2
    ORDER BY u.usage_date DESC;`,
    [lotId, tenantId]
  );
  return rows.map((r: Record<string, unknown>) => ({
    usageId: r.usage_id as string, usageDate: r.usage_date as string,
    quantityUsed: Number(r.quantity_used),
    unitCost: Number(r.extended_cost) / Math.max(Number(r.quantity_used), 1),
    extendedCost: Number(r.extended_cost), treatmentArea: r.treatment_area as string | null,
    productName: null, patientFirstName: r.first_name as string | null,
    patientLastName: r.last_name as string | null, lotNumber: null,
  }));
}

/** Map a database row to InventoryItemResponse */
function mapItemRow(r: Record<string, unknown>): InventoryItemResponse {
  return {
    itemId: r.item_id as string, zenotiProductId: r.zenoti_product_id as string,
    productName: r.product_name as string, manufacturer: r.manufacturer as string | null,
    brandFamily: r.brand_family as string | null, productType: r.product_type as string,
    unitOfMeasure: r.unit_of_measure as string,
    unitsPerPackage: r.units_per_package as number | null,
    defaultCost: r.default_cost as number | null, defaultPrice: r.default_price as number | null,
  };
}
