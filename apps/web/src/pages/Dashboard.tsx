// =============================================================================
// Dashboard.tsx — Main dashboard page with KPI grid
// Implements: REQ-UI-01, REQ-KPI-01, DD-32 §10.1
// =============================================================================

import { useEffect } from 'react';
import { Dashboard as DashboardLayout } from '../components/Dashboard.js';
import { KPICard } from '../components/KPICard.js';
import { DateRangePicker, type PresetPeriod } from '../components/DateRangePicker.js';
import { useKPI } from '../hooks/useKPI.js';

/**
 * Dashboard page showing KPI grid with period filter.
 * Fetches KPIs from /dashboard/kpis on mount and when
 * the period selection changes (DD-32 §10.1).
 */
export function Dashboard() {
  const { kpis, isLoading, error, period, fetchKPIs } = useKPI();

  useEffect(() => {
    fetchKPIs('mtd');
  }, [fetchKPIs]);

  /** Handle period change from DateRangePicker. */
  const handlePeriodChange = (newPeriod: PresetPeriod, startDate?: string, endDate?: string) => {
    fetchKPIs(newPeriod, startDate, endDate);
  };

  return (
    <div>
      <h2 className="dashboard__title">Dashboard</h2>
      <div className="dashboard__controls">
        <DateRangePicker period={period} onChange={handlePeriodChange} />
      </div>
      {error && <div className="dashboard__error">Error: {error}</div>}
      <DashboardLayout>
        {isLoading ? (
          <div>Loading KPIs…</div>
        ) : (
          kpis.map((kpi) => (
            <KPICard
              key={kpi.key}
              kpiKey={kpi.key}
              label={kpi.label}
              value={kpi.value}
              changePct={kpi.changePct}
              format={kpi.format}
            />
          ))
        )}
      </DashboardLayout>
    </div>
  );
}
