// =============================================================================
// consumables-query.ts — Consumables % of Revenue (overall, by category, by provider)
// Implements: REQ-KPI-03, DD-32 §10
// SQL Source: KPI-SQL-01 §6.1, §6.2, §6.3
// =============================================================================

import { pool } from '../../db.js';
import type { PoolClient } from 'pg';

/** Consumables percentage row. */
export interface ConsumablesPctRow {
  name?: string;
  earnedRevenue: number;
  consumablesCost: number;
  consumablesPct: number;
}

// KPI-SQL-01 §6.1 — Overall Consumables %
const OVERALL_SQL = `
  SELECT SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(c.direct_cost_amount), 0) AS consumables_cost,
    ROUND(COALESCE(SUM(c.direct_cost_amount), 0)::numeric
      / NULLIF(SUM(re.earned_amount), 0), 4) AS consumables_pct
  FROM fct_revenue_events re
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
    AND c.cost_type = 'consumables'
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1`;

// KPI-SQL-01 §6.2 — Consumables % by Category
const BY_CATEGORY_SQL = `
  SELECT dc.category_name AS name,
    SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(c.direct_cost_amount), 0) AS consumables_cost,
    ROUND(COALESCE(SUM(c.direct_cost_amount), 0)::numeric
      / NULLIF(SUM(re.earned_amount), 0), 4) AS consumables_pct
  FROM fct_revenue_events re
  JOIN dim_categories dc ON dc.category_id = re.category_id
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
    AND c.cost_type = 'consumables'
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
  GROUP BY dc.category_name
  ORDER BY consumables_pct DESC`;

// KPI-SQL-01 §6.3 — Consumables % by Provider
const BY_PROVIDER_SQL = `
  SELECT dp.first_name || ' ' || dp.last_name AS name,
    SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(c.direct_cost_amount), 0) AS consumables_cost,
    ROUND(COALESCE(SUM(c.direct_cost_amount), 0)::numeric
      / NULLIF(SUM(re.earned_amount), 0), 4) AS consumables_pct
  FROM fct_revenue_events re
  JOIN dim_providers dp ON dp.provider_id = re.provider_id
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
    AND c.cost_type = 'consumables'
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
  GROUP BY dp.provider_id, dp.first_name, dp.last_name
  ORDER BY consumables_pct DESC`;

/** Map a row to ConsumablesPctRow. */
function mapRow(r: Record<string, unknown>): ConsumablesPctRow {
  return {
    name: r.name as string | undefined,
    earnedRevenue: Number(r.earned_revenue),
    consumablesCost: Number(r.consumables_cost),
    consumablesPct: Number(r.consumables_pct),
  };
}

/** Overall consumables %. KPI-SQL-01 §6.1. */
export async function getConsumablesPctOverall(
  tenantId: string, client?: PoolClient,
): Promise<ConsumablesPctRow> {
  const conn = client ?? pool;
  const { rows } = await conn.query(OVERALL_SQL, [tenantId]);
  return mapRow(rows[0] ?? { earned_revenue: 0, consumables_cost: 0, consumables_pct: 0 });
}

/** Consumables % by category. KPI-SQL-01 §6.2. */
export async function getConsumablesPctByCategory(
  tenantId: string, client?: PoolClient,
): Promise<ConsumablesPctRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_CATEGORY_SQL, [tenantId]);
  return rows.map(mapRow);
}

/** Consumables % by provider. KPI-SQL-01 §6.3. */
export async function getConsumablesPctByProvider(
  tenantId: string, client?: PoolClient,
): Promise<ConsumablesPctRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_PROVIDER_SQL, [tenantId]);
  return rows.map(mapRow);
}
