// =============================================================================
// contribution-margin-query.ts — Contribution Margin by Provider, per Hour, by Category
// Implements: REQ-KPI-03, DD-32 §10 (GET /reports/contribution-margin)
// SQL Source: KPI-SQL-01 §5.1, §5.2, §5.3
// =============================================================================

import { pool } from '../../db.js';
import type { PoolClient } from 'pg';

/** Contribution margin row — provider or category level. */
export interface ContributionMarginRow {
  name: string;
  role?: string;
  earnedRevenue: number;
  consumablesCost: number;
  variableCompensation: number;
  contributionMargin: number;
  contributionMarginPct: number;
}

/** Contribution margin per hour — provider with hours data. */
export interface ContributionMarginPerHourRow {
  providerName: string;
  earnedRevenue: number;
  contributionMargin: number;
  scheduledHours: number;
  contributionMarginPerHour: number;
}

// KPI-SQL-01 §5.1 — Contribution Margin by Provider
const BY_PROVIDER_SQL = `
  SELECT dp.first_name || ' ' || dp.last_name AS name, dp.role,
    SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(CASE WHEN c.cost_type = 'consumables' THEN c.direct_cost_amount ELSE 0 END), 0) AS consumables_cost,
    COALESCE(SUM(CASE WHEN c.cost_type = 'variable_compensation' THEN c.direct_cost_amount ELSE 0 END), 0) AS variable_compensation,
    SUM(re.earned_amount)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'consumables' THEN c.direct_cost_amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'variable_compensation' THEN c.direct_cost_amount ELSE 0 END), 0)
      AS contribution_margin,
    ROUND((SUM(re.earned_amount)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'consumables' THEN c.direct_cost_amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'variable_compensation' THEN c.direct_cost_amount ELSE 0 END), 0)
    )::numeric / NULLIF(SUM(re.earned_amount), 0), 4) AS contribution_margin_pct
  FROM fct_revenue_events re
  JOIN dim_providers dp ON dp.provider_id = re.provider_id
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
  GROUP BY dp.provider_id, dp.first_name, dp.last_name, dp.role
  ORDER BY contribution_margin DESC`;

// KPI-SQL-01 §5.2 — Contribution Margin per Provider Hour
const PER_HOUR_SQL = `
  WITH provider_revenue AS (
    SELECT dp.provider_id,
      dp.first_name || ' ' || dp.last_name AS provider_name,
      SUM(re.earned_amount) AS earned_revenue,
      SUM(re.earned_amount)
        - COALESCE(SUM(CASE WHEN c.cost_type = 'consumables' THEN c.direct_cost_amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN c.cost_type = 'variable_compensation' THEN c.direct_cost_amount ELSE 0 END), 0)
        AS contribution_margin
    FROM fct_revenue_events re
    JOIN dim_providers dp ON dp.provider_id = re.provider_id
    LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
    WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
    GROUP BY dp.provider_id, dp.first_name, dp.last_name
  ),
  provider_hours AS (
    SELECT provider_id, SUM(scheduled_hours) AS total_scheduled_hours
    FROM fct_provider_hours
    WHERE date >= CURRENT_DATE - INTERVAL '30 days' AND tenant_id = $1
    GROUP BY provider_id
  )
  SELECT pr.provider_name, pr.earned_revenue, pr.contribution_margin,
    COALESCE(ph.total_scheduled_hours, 0) AS scheduled_hours,
    ROUND(pr.contribution_margin::numeric / NULLIF(ph.total_scheduled_hours, 0), 2)
      AS contribution_margin_per_hour
  FROM provider_revenue pr
  LEFT JOIN provider_hours ph ON ph.provider_id = pr.provider_id
  ORDER BY contribution_margin_per_hour DESC`;

// KPI-SQL-01 §5.3 — Contribution Margin by Category
const BY_CATEGORY_SQL = `
  SELECT dc.category_name AS name,
    SUM(re.earned_amount) AS earned_revenue,
    COALESCE(SUM(CASE WHEN c.cost_type = 'consumables' THEN c.direct_cost_amount ELSE 0 END), 0) AS consumables_cost,
    COALESCE(SUM(CASE WHEN c.cost_type = 'variable_compensation' THEN c.direct_cost_amount ELSE 0 END), 0) AS variable_compensation,
    SUM(re.earned_amount)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'consumables' THEN c.direct_cost_amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'variable_compensation' THEN c.direct_cost_amount ELSE 0 END), 0)
      AS contribution_margin,
    ROUND((SUM(re.earned_amount)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'consumables' THEN c.direct_cost_amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN c.cost_type = 'variable_compensation' THEN c.direct_cost_amount ELSE 0 END), 0)
    )::numeric / NULLIF(SUM(re.earned_amount), 0), 4) AS contribution_margin_pct
  FROM fct_revenue_events re
  JOIN dim_categories dc ON dc.category_id = re.category_id
  LEFT JOIN fct_cost_events c ON c.visit_service_id = re.visit_service_id
  WHERE re.revenue_type = 'earned' AND re.tenant_id = $1
  GROUP BY dc.category_name
  ORDER BY contribution_margin DESC`;

/** Map a row to ContributionMarginRow. */
function mapMarginRow(r: Record<string, unknown>): ContributionMarginRow {
  return {
    name: r.name as string,
    role: r.role as string | undefined,
    earnedRevenue: Number(r.earned_revenue),
    consumablesCost: Number(r.consumables_cost),
    variableCompensation: Number(r.variable_compensation),
    contributionMargin: Number(r.contribution_margin),
    contributionMarginPct: Number(r.contribution_margin_pct),
  };
}

/** Contribution margin by provider. KPI-SQL-01 §5.1. */
export async function getContributionMarginByProvider(
  tenantId: string, client?: PoolClient,
): Promise<ContributionMarginRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_PROVIDER_SQL, [tenantId]);
  return rows.map(mapMarginRow);
}

/** Contribution margin per provider hour. KPI-SQL-01 §5.2. */
export async function getContributionMarginPerHour(
  tenantId: string, client?: PoolClient,
): Promise<ContributionMarginPerHourRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(PER_HOUR_SQL, [tenantId]);
  return rows.map((r: Record<string, unknown>) => ({
    providerName: r.provider_name as string,
    earnedRevenue: Number(r.earned_revenue),
    contributionMargin: Number(r.contribution_margin),
    scheduledHours: Number(r.scheduled_hours),
    contributionMarginPerHour: Number(r.contribution_margin_per_hour),
  }));
}

/** Contribution margin by category. KPI-SQL-01 §5.3. */
export async function getContributionMarginByCategory(
  tenantId: string, client?: PoolClient,
): Promise<ContributionMarginRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_CATEGORY_SQL, [tenantId]);
  return rows.map(mapMarginRow);
}
