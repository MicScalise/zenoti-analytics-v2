// =============================================================================
// Test Factory — InventoryUsage (DD-31 §6.6 fct_inventory_usage)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { InventoryUsage } from '@za/shared';

let counter = 0;

/**
 * Build an InventoryUsage test fixture with sensible defaults.
 * All field names match DD-31 §6.6 column names exactly.
 * extended_cost = quantity_used * unit_cost_at_time (DD-31 CHECK constraint).
 */
export function buildInventoryUsage(overrides: Partial<InventoryUsage> = {}): InventoryUsage {
  counter++;
  const quantity = 1;
  const unitCost = 5.50;
  return {
    usage_id: `c0000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    visit_service_id: '60000000-0000-0000-0000-000000000001',
    lot_id: 'b0000000-0000-0000-0000-000000000001',
    inventory_item_id: 'a0000000-0000-0000-0000-000000000001',
    usage_date: '2026-04-27',
    quantity_used: quantity,
    unit_cost_at_time: unitCost,
    extended_cost: quantity * unitCost,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
