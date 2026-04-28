// =============================================================================
// Test Factory — InventoryItem (DD-31 §5.8 dim_inventory_items)
// Implements: DR-005 (field names from DD-31, not imagined)
// =============================================================================
import type { InventoryItem, ProductType } from '@za/shared';

let counter = 0;

/**
 * Build an InventoryItem test fixture with sensible defaults.
 * All field names match DD-31 §5.8 column names exactly.
 */
export function buildInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  counter++;
  return {
    item_id: `a0000000-0000-0000-0000-${String(counter).padStart(12, '0')}`,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    zenoti_product_id: `zenoti-product-${counter}`,
    product_name: `Botox ${counter}`,
    product_type: 'neuromodulator' as ProductType,
    unit_of_measure: 'unit',
    is_active: true,
    effective_start: '2025-01-01',
    effective_end: '2100-12-31',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
