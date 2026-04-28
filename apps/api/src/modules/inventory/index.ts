// =============================================================================
// Inventory Module — Public API
// Implements: TASK-020 (module barrel export)
// ============================================================================

export { inventoryRouter } from './routes.js';
export {
  listActiveItems, getItemByZenotiId, createLot,
  recordUsage, getUsageByLot
} from './services/inventory-service.js';
export type { InventoryItemResponse, InventoryLotResponse, InventoryUsageResponse } from './services/inventory-service.js';
