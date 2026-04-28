// =============================================================================
// Zod Validators — Inventory request validation (DD-32 inventory endpoints)
// Implements: EP §14, DD-31 §5.8–5.9, §6.6 (dim_inventory_items,
// dim_inventory_lots, fct_inventory_usage columns)
// Field names match DD-31 column names exactly.
// ============================================================================

import { z } from 'zod';

/** Create inventory item request body */
export const createInventoryItemSchema = z.object({
  zenoti_product_id: z.string().min(1),
  sku: z.string().optional(),
  product_name: z.string().min(1),
  manufacturer: z.string().optional(),
  brand_family: z.string().optional(),
  product_type: z.enum(['neuromodulator', 'dermal_filler', 'skincare', 'retail', 'disposable']),
  product_subtype: z.string().optional(),
  unit_of_measure: z.string().min(1),
  units_per_package: z.number().int().positive().optional(),
  default_cost: z.number().nonnegative().optional(),
  default_price: z.number().nonnegative().optional(),
});

/** Create inventory lot request body */
export const createInventoryLotSchema = z.object({
  item_id: z.string().uuid(),
  lot_number: z.string().min(1),
  received_date: z.string(),
  expiration_date: z.string(),
  vendor_id: z.string().optional(),
  received_quantity: z.number().positive(),
  received_unit_cost: z.number().nonnegative(),
});

/** Record inventory usage request body */
export const createInventoryUsageSchema = z.object({
  zenoti_usage_id: z.string().optional(),
  visit_service_id: z.string().uuid(),
  lot_id: z.string().uuid(),
  inventory_item_id: z.string().uuid(),
  usage_date: z.string(),
  quantity_used: z.number().positive(),
  unit_cost_at_time: z.number().nonnegative(),
  extended_cost: z.number().nonnegative(),
  treatment_area: z.string().optional(),
}).refine(
  // extended_cost = quantity_used * unit_cost_at_time (DD-31 §6.6 CHECK)
  (data) => Math.abs(data.extended_cost - data.quantity_used * data.unit_cost_at_time) < 0.01,
  { message: 'extended_cost must equal quantity_used * unit_cost_at_time' },
);

/** Inventory query filter */
export const inventoryQuerySchema = z.object({
  product_type: z.enum(['neuromodulator', 'dermal_filler', 'skincare', 'retail', 'disposable']).optional(),
  is_expired: z.boolean().optional(),
  low_stock: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type CreateInventoryLotInput = z.infer<typeof createInventoryLotSchema>;
export type CreateInventoryUsageInput = z.infer<typeof createInventoryUsageSchema>;
export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;
