// =============================================================================
// revenue-by-hour-query.ts — Revenue by Hour of Day (overall, by provider, by category)
// Implements: REQ-KPI-05 (Mike's custom KPI), DD-32 §8.1 byHourOfDay
// SQL Source: KPI-SQL-01 §10.1, §10.2, §10.3
// =============================================================================

import { pool } from '../../db.js';
import type { PoolClient } from 'pg';

/** Revenue by hour row. */
export interface RevenueByHourRow {
  name?: string;
  hourOfDay: number;
  visitCount: number;
  totalRevenue: number;
  avgRevenuePerVisit: number;
}

// KPI-SQL-01 §10.1 — Revenue by Hour of Day (Overall)
const OVERALL_SQL = `
  SELECT EXTRACT(HOUR FROM v.actual_start) AS hour_of_day,
    COUNT(DISTINCT v.visit_id) AS visit_count,
    SUM(vvs.net_revenue) AS total_revenue,
    ROUND(SUM(vvs.net_revenue)::numeric / NULLIF(COUNT(DISTINCT v.visit_id), 0), 2) AS avg_revenue_per_visit
  FROM fct_visits v
  JOIN fct_visit_services vvs ON vvs.visit_id = v.visit_id
  WHERE v.visit_status = 'completed' AND v.no_show_flag = false
    AND v.actual_start IS NOT NULL AND v.tenant_id = $1
  GROUP BY EXTRACT(HOUR FROM v.actual_start)
  ORDER BY hour_of_day`;

// KPI-SQL-01 §10.2 — Revenue by Hour of Day by Provider
const BY_PROVIDER_SQL = `
  SELECT dp.first_name || ' ' || dp.last_name AS name,
    EXTRACT(HOUR FROM v.actual_start) AS hour_of_day,
    COUNT(DISTINCT v.visit_id) AS visit_count,
    SUM(vvs.net_revenue) AS total_revenue,
    ROUND(SUM(vvs.net_revenue)::numeric / NULLIF(COUNT(DISTINCT v.visit_id), 0), 2) AS avg_revenue_per_visit
  FROM fct_visits v
  JOIN fct_visit_services vvs ON vvs.visit_id = v.visit_id
  JOIN dim_providers dp ON dp.provider_id = v.provider_id
  WHERE v.visit_status = 'completed' AND v.no_show_flag = false
    AND v.actual_start IS NOT NULL AND v.tenant_id = $1
  GROUP BY dp.provider_id, dp.first_name, dp.last_name, EXTRACT(HOUR FROM v.actual_start)
  ORDER BY dp.first_name, hour_of_day`;

// KPI-SQL-01 §10.3 — Revenue by Hour of Day by Category
const BY_CATEGORY_SQL = `
  SELECT dc.category_name AS name,
    EXTRACT(HOUR FROM v.actual_start) AS hour_of_day,
    COUNT(DISTINCT v.visit_id) AS visit_count,
    SUM(vvs.net_revenue) AS total_revenue,
    ROUND(SUM(vvs.net_revenue)::numeric / NULLIF(COUNT(DISTINCT v.visit_id), 0), 2) AS avg_revenue_per_visit
  FROM fct_visits v
  JOIN fct_visit_services vvs ON vvs.visit_id = v.visit_id
  JOIN dim_categories dc ON dc.category_id = vvs.category_id
  WHERE v.visit_status = 'completed' AND v.no_show_flag = false
    AND v.actual_start IS NOT NULL AND v.tenant_id = $1
  GROUP BY dc.category_name, EXTRACT(HOUR FROM v.actual_start)
  ORDER BY dc.category_name, hour_of_day`;

/** Map a row to RevenueByHourRow. */
function mapRow(r: Record<string, unknown>): RevenueByHourRow {
  return {
    name: r.name as string | undefined,
    hourOfDay: Number(r.hour_of_day),
    visitCount: Number(r.visit_count),
    totalRevenue: Number(r.total_revenue),
    avgRevenuePerVisit: Number(r.avg_revenue_per_visit),
  };
}

/** Revenue by hour of day — overall. KPI-SQL-01 §10.1. */
export async function getRevenueByHourOverall(
  tenantId: string, client?: PoolClient,
): Promise<RevenueByHourRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(OVERALL_SQL, [tenantId]);
  return rows.map(mapRow);
}

/** Revenue by hour of day — by provider. KPI-SQL-01 §10.2. */
export async function getRevenueByHourByProvider(
  tenantId: string, client?: PoolClient,
): Promise<RevenueByHourRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_PROVIDER_SQL, [tenantId]);
  return rows.map(mapRow);
}

/** Revenue by hour of day — by category. KPI-SQL-01 §10.3. */
export async function getRevenueByHourByCategory(
  tenantId: string, client?: PoolClient,
): Promise<RevenueByHourRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_CATEGORY_SQL, [tenantId]);
  return rows.map(mapRow);
}
