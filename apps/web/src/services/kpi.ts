// =============================================================================
// kpi.ts — KPI service (API calls for dashboard metrics)
// Implements: REQ-KPI-01, DD-32 §10 (reporting endpoints)
// =============================================================================

import { apiClient } from './api.js';

/** Preset period types matching DD-32 §10.1. */
export type PresetPeriod = 'mtd' | 'last30d' | 'custom';

/** Single KPI data point from the dashboard API. */
export interface KPIData {
  key: string;
  label: string;
  value: number;
  changePct?: number;
  changeDirection?: 'up' | 'down' | 'flat';
  format?: 'currency' | 'pct' | 'number';
}

/** Dashboard KPIs response shape (DD-32 §10.1). */
interface DashboardKPIsResponse {
  period: { start: string; end: string };
  kpis: KPIData[];
}

/**
 * Fetches dashboard KPIs from GET /dashboard/kpis (DD-32 §10.1).
 * Supports MTD, Last 30d, and Custom period selections.
 *
 * @param period — Preset period or 'custom'
 * @param startDate — Required when period is 'custom'
 * @param endDate — Required when period is 'custom'
 * @param locationId — Optional location filter
 * @returns Array of KPI data points
 */
export async function fetchDashboardKPIs(
  period: PresetPeriod,
  startDate?: string,
  endDate?: string,
  locationId?: string,
): Promise<KPIData[]> {
  const params: Record<string, string> = { period };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (locationId) params.locationId = locationId;

  const { data } = await apiClient.get<{ data: DashboardKPIsResponse }>(
    '/dashboard/kpis',
    { params },
  );
  return data.data.kpis;
}

/**
 * Fetches retention cohort data from GET /reports/retention (DD-32 §10.2).
 *
 * @param format — Response format: 'json' or 'csv'
 */
export async function fetchRetentionReport(format: 'json' | 'csv' = 'json') {
  const { data } = await apiClient.get('/reports/retention', {
    params: { format },
  });
  return data;
}
