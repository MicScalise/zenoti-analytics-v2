// =============================================================================
// useKPI.ts — KPI data fetching hook
// Implements: REQ-KPI-01 (KPI display), DD-32 §10.1 (dashboard KPIs)
// =============================================================================

import { useState, useCallback } from 'react';
import { fetchDashboardKPIs, type KPIData, type PresetPeriod } from '../services/kpi.js';

/** State exposed by the useKPI hook. */
interface KPIState {
  /** Array of KPI data points from the API */
  kpis: KPIData[];
  /** Whether KPI data is currently loading */
  isLoading: boolean;
  /** Error message if the fetch failed */
  error: string | undefined;
  /** Currently selected period preset */
  period: PresetPeriod;
}

/**
 * Hook for fetching and managing dashboard KPI data.
 * Calls GET /dashboard/kpis with the selected period (DD-32 §10.1).
 * Returns KPI array, loading state, error, and refresh function.
 */
export function useKPI() {
  const [state, setState] = useState<KPIState>({
    kpis: [],
    isLoading: false,
    error: undefined,
    period: 'mtd',
  });

  /** Fetch KPIs from the API for the given period. */
  const fetchKPIs = useCallback(async (
    period: PresetPeriod,
    startDate?: string,
    endDate?: string,
    locationId?: string,
  ) => {
    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));
    try {
      const result = await fetchDashboardKPIs(period, startDate, endDate, locationId);
      setState({ kpis: result, isLoading: false, error: undefined, period });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch KPIs';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  return { ...state, fetchKPIs };
}
