// =============================================================================
// Test Factory — InventoryLot (DD-31 §5.9 dim_inventory_lots)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { InventoryLot } from '@za/shared';

let counter = 0;

/**
 * Build an InventoryLot test fixture with sensible defaults.
 * All field names match DD-31 §5.9 column names exactly.
 */
export function buildInventoryLot(overrides: Partial<InventoryLot> = {}): InventoryLot {
  counter++;
  return {
    lot_id: `b0000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    item_id: 'a0000000-0000-0000-0000-000000000001',
    lot_number: `LOT-${counter}`,
    received_date: '2026-01-15',
    expiration_date: '2027-01-15',
    received_quantity: 100,
    received_unit_cost: 5.50,
    quantity_on_hand: 80,
    is_expired: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
