// =============================================================================
// Inventory.tsx — Inventory catalog and lot details page
// Implements: REQ-UI-01, DD-32 §9 (inventory endpoints)
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { DataTable, type Column } from '../components/DataTable.js';
import { apiClient } from '../services/api.js';

/** Inventory item from GET /inventory/items (DD-32 §9.1). */
interface InventoryItem {
  [key: string]: unknown;
  itemId: string;
  productName: string;
  manufacturer: string;
  productType: string;
  quantityOnHand: number;
  defaultCost: number;
  defaultPrice: number;
}

/** Column definitions for the inventory table. */
const INV_COLUMNS: Column<InventoryItem>[] = [
  { key: 'productName', label: 'Product', sortable: true },
  { key: 'productType', label: 'Type', sortable: true },
];

/**
 * Inventory page showing product catalog with filters.
 * Fetches items from /inventory/items on mount (DD-32 §9.1).
 */
export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get<{ data: InventoryItem[] }>('/inventory/items');
      setItems(data.data || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (isLoading) return <div>Loading inventory...</div>;

  return (
    <div className="page-inventory">
      <h1>Inventory</h1>
      <DataTable<InventoryItem>
        hasMore={false}
        hasPrev={false}
        onNext={() => {}}
        onPrev={() => {}}
        columns={INV_COLUMNS}
        data={items}
      />
    </div>
  );
}
