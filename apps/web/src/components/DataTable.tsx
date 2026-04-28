// =============================================================================
// DataTable.tsx — Reusable data table with cursor-based pagination
// Implements: REQ-UI-01 (data table component), DD-32 (cursor pagination)
// =============================================================================

import { ReactNode, useCallback } from 'react';

export interface Column<T> {
  /** Field key in the data object */
  key: string;
  /** Display header text */
  label: string;
  /** Optional custom render function for this cell */
  render?: (row: T) => ReactNode;
  /** Whether this column is sortable */
  sortable?: boolean;
}

interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Row data */
  data: T[];
  /** Whether more rows exist after current page */
  hasMore: boolean;
  /** Whether previous page exists */
  hasPrev: boolean;
  /** Callback to load next page (cursor from API) */
  onNext: () => void;
  /** Callback to load previous page */
  onPrev: () => void;
  /** Optional sort callback */
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Reusable data table with cursor-based pagination.
 * Supports sortable columns and custom cell renderers.
 * Pagination uses cursor tokens from the API (DD-32).
 */
export function DataTable<T extends Record<string, unknown>>({
  columns, data, hasMore, hasPrev, onNext, onPrev, onSort, isLoading,
}: DataTableProps<T>) {
  const handleSort = useCallback((key: string) => {
    if (!onSort) return;
    onSort(key, 'asc');
  }, [onSort]);

  return (
    <div className="data-table" role="table">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} onClick={() => col.sortable && handleSort(col.key)}>
                {col.label} {col.sortable && '↕'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length}>Loading…</td></tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="data-table__pagination">
        <button disabled={!hasPrev} onClick={onPrev}>← Prev</button>
        <button disabled={!hasMore} onClick={onNext}>Next →</button>
      </div>
    </div>
  );
}
