// =============================================================================
// Dashboard Service — Aggregated KPI dashboard endpoint
// Implements: DD-32 §10.1 (GET /api/v1/dashboard/kpis)
// ============================================================================

import { getRevenueSummary, getRetentionCohorts, RevenueSummary, RetentionCohort } from './kpi-service.js';

/** Dashboard KPI item for the frontend */
export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  changePct?: number;
  changeDirection?: 'up' | 'down' | 'flat';
  format?: 'currency' | 'pct' | 'number';
}

/** Dashboard response — matches DD-32 §10.1 */
export interface DashboardResponse {
  period: { start: string; end: string };
  kpis: DashboardKpi[];
  cohorts?: RetentionCohort[];
}

/**
 * Build the dashboard KPI response.
 * Aggregates revenue summary and retention data into dashboard format.
 *
 * @param tenantId — tenant UUID
 * @param period — 'mtd', 'last30d', or 'custom'
 * @param startDate — custom period start
 * @param endDate — custom period end
 */
export async function getDashboard(
  tenantId: string,
  period: string,
  startDate?: string,
  endDate?: string
): Promise<DashboardResponse> {
  // Resolve date range based on period selector
  const { resolvedStart, resolvedEnd } = resolvePeriod(period, startDate, endDate);

  // Fetch revenue summary
  const revenue = await getRevenueSummary(tenantId, resolvedStart, resolvedEnd);

  // Map revenue to dashboard KPI items
  const kpis: DashboardKpi[] = [
    { key: 'totalRevenue', label: 'Total Revenue', value: revenue.totalRevenue, format: 'currency' },
    { key: 'totalVisits', label: 'Total Visits', value: revenue.totalVisits, format: 'number' },
    { key: 'totalPatients', label: 'Total Patients', value: revenue.totalPatients, format: 'number' },
    { key: 'avgRevenuePerVisit', label: 'Avg Revenue/Visit', value: revenue.avgRevenuePerVisit, format: 'currency' },
    { key: 'avgRevenuePerPatient', label: 'Avg Revenue/Patient', value: revenue.avgRevenuePerPatient, format: 'currency' },
    { key: 'grossMargin', label: 'Gross Margin', value: revenue.grossMargin, format: 'currency' },
    { key: 'grossMarginPct', label: 'Gross Margin %', value: revenue.grossMarginPct, format: 'pct' },
  ];

  // Fetch retention cohorts
  const cohorts = await getRetentionCohorts(tenantId);

  // Compute 90-day retention from latest cohort
  if (cohorts.length > 0) {
    const latest = cohorts[0];
    const retention90d = latest.cohortSize > 0 ? latest.returned3 / latest.cohortSize : 0;
    kpis.push({ key: 'retention90d', label: '90-Day Retention', value: retention90d, format: 'pct' });
  }

  return {
    period: { start: resolvedStart, end: resolvedEnd },
    kpis,
    cohorts,
  };
}

/**
 * Resolve period string to actual date range.
 * 'mtd' = first of month to today; 'last30d' = 30 days ago to today.
 */
function resolvePeriod(period: string, startDate?: string, endDate?: string): { resolvedStart: string; resolvedEnd: string } {
  const today = new Date().toISOString().split('T')[0];

  if (period === 'custom' && startDate && endDate) {
    return { resolvedStart: startDate, resolvedEnd: endDate };
  }

  if (period === 'last30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return { resolvedStart: d.toISOString().split('T')[0], resolvedEnd: today };
  }

  // Default: mtd (month to date)
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  return { resolvedStart: firstOfMonth, resolvedEnd: today };
}
