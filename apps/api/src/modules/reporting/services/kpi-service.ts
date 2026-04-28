// =============================================================================
// KPI Service — Revenue summary and profitability queries
// Implements: DD-36 §10.1, §10.3 (VERBATIM SQL)
// DR-042: Earned revenue queries filter item_type IN ('Service','Product')
// ============================================================================

import { pool } from '../../db.js';
import type { RevenueSummary, NeuromodulatorProfitability } from './kpi-types.js';
export type { RevenueSummary, NeuromodulatorProfitability } from './kpi-types.js';
export { getRetentionCohorts } from './retention-query.js';
export type { RetentionCohort } from './kpi-types.js';

/**
 * Get revenue summary KPIs.
 * DD-36 §10.1 VERBATIM — Revenue Summary Query.
 *
 * @param tenantId — tenant UUID
 * @param startDate — period start date
 * @param endDate — period end date
 * @param locationId — optional location filter
 * @param providerId — optional provider filter
 * @param categoryId — optional category filter
 */
export async function getRevenueSummary(
  tenantId: string, startDate: string, endDate: string,
  locationId?: string, providerId?: string, categoryId?: string
): Promise<RevenueSummary> {
  const { rows } = await pool.query(
    `SELECT
      COALESCE(SUM(vs.net_revenue), 0) AS total_revenue,
      COUNT(DISTINCT v.visit_id) AS total_visits,
      COUNT(DISTINCT v.patient_id) AS total_patients,
      COALESCE(AVG(vs.net_revenue), 0) AS avg_revenue_per_visit,
      COALESCE(SUM(vs.net_revenue) / NULLIF(COUNT(DISTINCT v.patient_id), 0), 0) AS avg_revenue_per_patient,
      COALESCE(SUM(vs.gross_revenue) - SUM(vs.discounts), 0) AS gross_margin,
      (COALESCE(SUM(vs.gross_revenue) - SUM(vs.discounts), 0) / NULLIF(SUM(vs.gross_revenue), 0)) AS gross_margin_pct
    FROM fct_visits v
    JOIN fct_visit_services vs ON v.visit_id = vs.visit_id
    WHERE v.tenant_id = $1
      AND v.visit_date BETWEEN $2 AND $3
      AND ($4::uuid IS NULL OR v.location_id = $4)
      AND ($5::uuid IS NULL OR v.provider_id = $5)
      AND ($6::uuid IS NULL OR vs.category_id = $6);`,
    [tenantId, startDate, endDate, locationId ?? null, providerId ?? null, categoryId ?? null]
  );

  const r = rows[0];
  return {
    totalRevenue: Number(r.total_revenue), totalVisits: Number(r.total_visits),
    totalPatients: Number(r.total_patients), avgRevenuePerVisit: Number(r.avg_revenue_per_visit),
    avgRevenuePerPatient: Number(r.avg_revenue_per_patient), grossMargin: Number(r.gross_margin),
    grossMarginPct: Number(r.gross_margin_pct),
  };
}

/**
 * Get neuromodulator profitability data.
 * DD-36 §10.3 VERBATIM — Neuromodulator Profitability Query.
 *
 * @param tenantId — tenant UUID
 * @param startDate — period start
 * @param endDate — period end
 */
export async function getNeuromodulatorProfitability(
  tenantId: string, startDate: string, endDate: string
): Promise<NeuromodulatorProfitability[]> {
  const { rows } = await pool.query(
    `SELECT c.category_name, i.brand_family, u.treatment_area,
      COUNT(DISTINCT v.visit_id) AS treatment_count,
      SUM(u.quantity_used) AS total_units_used,
      SUM(u.extended_cost) AS total_cost,
      SUM(vs.net_revenue) AS total_revenue,
      SUM(vs.net_revenue) - SUM(u.extended_cost) AS gross_profit,
      (SUM(vs.net_revenue) - SUM(u.extended_cost)) / NULLIF(SUM(vs.net_revenue), 0) AS gross_margin_pct
    FROM fct_visits v
    JOIN fct_visit_services vs ON v.visit_id = vs.visit_id
    JOIN fct_inventory_usage u ON vs.visit_service_id = u.visit_service_id
    JOIN dim_inventory_items i ON u.inventory_item_id = i.item_id
    JOIN dim_categories c ON vs.category_id = c.category_id
    WHERE v.tenant_id = $1 AND v.visit_date BETWEEN $2 AND $3 AND i.product_type = 'neuromodulator'
    GROUP BY c.category_name, i.brand_family, u.treatment_area
    ORDER BY gross_profit DESC;`,
    [tenantId, startDate, endDate]
  );

  return rows.map((r: Record<string, unknown>) => ({
    categoryName: r.category_name as string, brandFamily: r.brand_family as string,
    treatmentArea: r.treatment_area as string | null,
    treatmentCount: Number(r.treatment_count), totalUnitsUsed: Number(r.total_units_used),
    totalCost: Number(r.total_cost), totalRevenue: Number(r.total_revenue),
    grossProfit: Number(r.gross_profit), grossMarginPct: Number(r.gross_margin_pct),
  }));
}
