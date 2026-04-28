// =============================================================================
// gross-margin-query.ts — Gross Margin by Service, Category, and Provider
// Implements: REQ-KPI-03, DD-32 §10 (reporting endpoints)
// SQL Source: KPI-SQL-01 §4.1, §4.2, §4.3
// =============================================================================

import { pool } from '../../db.js';
import type { PoolClient } from 'pg';

/** Gross margin row — shared shape for service/category/provider breakdowns. */
export interface GrossMarginRow {
  name: string;
  category?: string;
  role?: string;
  earnedRevenue: number;
  consumablesCost: number;
  grossMarginDollars: number;
  grossMarginPct: number;
}

// KPI-SQL-01 §4.1 — Gross Margin by Service
const BY_SERVICE_SQL = `
  SELECT ds.service_name AS name, dc.category_name AS category,
    SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(c.direct_cost_amount), 0) AS consumables_cost,
    SUM(re.earned_amount) - COALESCE(SUM(c.direct_cost_amount), 0) AS gross_margin_dollars,
    ROUND((SUM(re.earned_amount) - COALESCE(SUM(c.direct_cost_amount), 0))::numeric
      / NULLIF(SUM(re.earned_amount), 0), 4) AS gross_margin_pct
  FROM fct_revenue_events re
  JOIN dim_services ds ON ds.service_id = re.service_id
  JOIN dim_categories dc ON dc.category_id = re.category_id
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
    AND c.cost_type = 'consumables'
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
  GROUP BY ds.service_name, dc.category_name
  ORDER BY gross_margin_dollars DESC`;

// KPI-SQL-01 §4.2 — Gross Margin by Category
const BY_CATEGORY_SQL = `
  SELECT dc.category_name AS name,
    SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(c.direct_cost_amount), 0) AS consumables_cost,
    SUM(re.earned_amount) - COALESCE(SUM(c.direct_cost_amount), 0) AS gross_margin_dollars,
    ROUND((SUM(re.earned_amount) - COALESCE(SUM(c.direct_cost_amount), 0))::numeric
      / NULLIF(SUM(re.earned_amount), 0), 4) AS gross_margin_pct
  FROM fct_revenue_events re
  JOIN dim_categories dc ON dc.category_id = re.category_id
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
    AND c.cost_type = 'consumables'
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
  GROUP BY dc.category_name
  ORDER BY gross_margin_dollars DESC`;

// KPI-SQL-01 §4.3 — Gross Margin by Provider
const BY_PROVIDER_SQL = `
  SELECT dp.first_name || ' ' || dp.last_name AS name, dp.role,
    SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(c.direct_cost_amount), 0) AS consumables_cost,
    SUM(re.earned_amount) - COALESCE(SUM(c.direct_cost_amount), 0) AS gross_margin_dollars,
    ROUND((SUM(re.earned_amount) - COALESCE(SUM(c.direct_cost_amount), 0))::numeric
      / NULLIF(SUM(re.earned_amount), 0), 4) AS gross_margin_pct
  FROM fct_revenue_events re
  JOIN dim_providers dp ON dp.provider_id = re.provider_id
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
    AND c.cost_type = 'consumables'
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
  GROUP BY dp.first_name, dp.last_name, dp.role
  ORDER BY gross_margin_dollars DESC`;

/** Map a database row to GrossMarginRow. */
function mapRow(r: Record<string, unknown>): GrossMarginRow {
  return {
    name: r.name as string,
    category: r.category as string | undefined,
    role: r.role as string | undefined,
    earnedRevenue: Number(r.earned_revenue),
    consumablesCost: Number(r.consumables_cost),
    grossMarginDollars: Number(r.gross_margin_dollars),
    grossMarginPct: Number(r.gross_margin_pct),
  };
}

/** Run a gross margin query and map results. */
async function queryMargin(
  sql: string, tenantId: string, client?: PoolClient,
): Promise<GrossMarginRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(sql, [tenantId]);
  return rows.map(mapRow);
}

/** Gross margin by service. KPI-SQL-01 §4.1. */
export async function getGrossMarginByService(
  tenantId: string, client?: PoolClient,
): Promise<GrossMarginRow[]> {
  return queryMargin(BY_SERVICE_SQL, tenantId, client);
}

/** Gross margin by category. KPI-SQL-01 §4.2. */
export async function getGrossMarginByCategory(
  tenantId: string, client?: PoolClient,
): Promise<GrossMarginRow[]> {
  return queryMargin(BY_CATEGORY_SQL, tenantId, client);
}

/** Gross margin by provider. KPI-SQL-01 §4.3. */
export async function getGrossMarginByProvider(
  tenantId: string, client?: PoolClient,
): Promise<GrossMarginRow[]> {
  return queryMargin(BY_PROVIDER_SQL, tenantId, client);
}
