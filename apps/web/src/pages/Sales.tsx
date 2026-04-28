// =============================================================================
// Sales.tsx — Revenue and sales report page
// Implements: REQ-UI-01, REQ-KPI-01, DD-32 §8 (revenue endpoints)
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { KPICard } from '../components/KPICard.js';
import { DateRangePicker, type PresetPeriod } from '../components/DateRangePicker.js';
import { apiClient } from '../services/api.js';

/** Revenue summary from GET /revenue/summary (DD-32 §8.1). */
interface RevenueSummary {
  totalRevenue: number;
  totalVisits: number;
  totalPatients: number;
  avgRevenuePerVisit: number;
  avgRevenuePerPatient: number;
  grossMargin: number;
  grossMarginPct: number;
}

/**
 * Sales page showing revenue KPIs and breakdown.
 * Calls GET /revenue/summary (DD-32 §8.1).
 * Earned revenue queries filter item_type IN ('Service','Product') (DR-042).
 */
export function Sales() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [period, setPeriod] = useState<PresetPeriod>('mtd');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  /** Fetch revenue summary from the API. */
  const fetchRevenue = useCallback(async (p: PresetPeriod, startDate?: string, endDate?: string) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const params: Record<string, string> = {};
      const now = new Date();
      if (p === 'mtd') {
        params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        params.endDate = now.toISOString().slice(0, 10);
      } else if (p === 'last30d') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        params.startDate = d.toISOString().slice(0, 10);
        params.endDate = now.toISOString().slice(0, 10);
      } else {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      const { data } = await apiClient.get<{ data: RevenueSummary }>('/revenue/summary', { params });
      setSummary(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load revenue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRevenue('mtd'); }, [fetchRevenue]);

  return (
    <div className="page-sales">
      <h2>Sales &amp; Revenue</h2>
      <DateRangePicker period={period} onChange={(p, sd, ed) => { setPeriod(p); fetchRevenue(p, sd, ed); }} />
      {error && <div className="page-sales__error">{error}</div>}
      {isLoading && <div>Loading…</div>}
      {summary && (
        <div className="page-sales__kpis">
          <KPICard kpiKey="totalRevenue" label="Total Revenue" value={summary.totalRevenue} format="currency" />
          <KPICard kpiKey="totalVisits" label="Total Visits" value={summary.totalVisits} format="number" />
          <KPICard kpiKey="avgPerVisit" label="Avg per Visit" value={summary.avgRevenuePerVisit} format="currency" />
          <KPICard kpiKey="grossMargin" label="Gross Margin" value={summary.grossMarginPct} format="pct" />
        </div>
      )}
    </div>
  );
}
