// =============================================================================
// ltv-query.ts — Patient Lifetime Value query service
// Implements: REQ-KPI-02, DD-32 §8.2 (GET /api/v1/revenue/patient-ltv)
// SQL Source: KPI-SQL-01 §2.1 (Historical LTV), §2.2 (Rolling 12-Month LTV)
// =============================================================================

import { pool } from '../../db.js';
import type { PoolClient } from 'pg';

/** Single patient's LTV data for the topPatients array. */
export interface PatientLTVRow {
  patientId: string;
  firstName: string;
  lastName: string;
  totalVisits: number;
  historicalLtvRevenue: number;
  historicalLtvGrossProfit: number;
  ltvRolling12m: number;
}

/** Aggregated LTV response matching DD-32 §8.2. */
export interface PatientLTVResult {
  totalPatients: number;
  avgHistoricalLTV: number;
  avgRolling12mLTV: number;
  topPatients: PatientLTVRow[];
}

// KPI-SQL-01 §2.1 + §2.2 combined — Historical and Rolling 12m LTV
// Tenant filtering via parameterized WHERE, optional patient filter
const LTV_QUERY = `
  WITH historical_ltv AS (
    SELECT
      p.patient_id, p.first_name, p.last_name, p.first_visit_date,
      COUNT(DISTINCT v.visit_id) AS total_visits,
      COALESCE(SUM(re.earned_amount), 0) AS historical_ltv_revenue,
      COALESCE(SUM(re.earned_amount) - SUM(COALESCE(c.direct_cost_amount, 0)), 0)
        AS historical_ltv_gross_profit
    FROM dim_patients p
    LEFT JOIN fct_visits v ON v.patient_id = p.patient_id
      AND v.visit_status = 'completed'
      AND v.no_show_flag = false
    LEFT JOIN fct_revenue_events re ON re.patient_id = p.patient_id
      AND re.revenue_type = 'earned'
    LEFT JOIN fct_cost_events c ON c.patient_id = p.patient_id
    WHERE p.tenant_id = $1
      AND ($2::uuid IS NULL OR p.patient_id = $2)
    GROUP BY p.patient_id, p.first_name, p.last_name, p.first_visit_date
  ),
  rolling_12m AS (
    SELECT re.patient_id, COALESCE(SUM(re.earned_amount), 0) AS ltv_rolling_12m
    FROM fct_revenue_events re
    WHERE re.revenue_type = 'earned'
      AND re.earned_date >= CURRENT_DATE - INTERVAL '12 months'
      AND re.tenant_id = $1
      AND ($2::uuid IS NULL OR re.patient_id = $2)
    GROUP BY re.patient_id
  )
  SELECT h.patient_id, h.first_name, h.last_name, h.total_visits,
    h.historical_ltv_revenue, h.historical_ltv_gross_profit,
    COALESCE(r.ltv_rolling_12m, 0) AS ltv_rolling_12m
  FROM historical_ltv h
  LEFT JOIN rolling_12m r ON r.patient_id = h.patient_id
  ORDER BY h.historical_ltv_revenue DESC`;

/**
 * Execute the LTV query and return raw rows.
 * Accepts a client for testability — caller can pass a test connection.
 */
async function queryLTV(
  tenantId: string, patientId: string | null, client?: PoolClient,
): Promise<Record<string, unknown>[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(LTV_QUERY, [tenantId, patientId]);
  return rows;
}

/** Map a database row to a PatientLTVRow. */
function mapRow(r: Record<string, unknown>): PatientLTVRow {
  return {
    patientId: r.patient_id as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    totalVisits: Number(r.total_visits),
    historicalLtvRevenue: Number(r.historical_ltv_revenue),
    historicalLtvGrossProfit: Number(r.historical_ltv_gross_profit),
    ltvRolling12m: Number(r.ltv_rolling_12m),
  };
}

/** Compute average of a numeric field across rows. */
function avg(rows: Record<string, unknown>[], field: string): number {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, r) => sum + Number(r[field]), 0) / rows.length;
}

/**
 * Fetch aggregated Patient LTV stats plus top patients ranked by revenue.
 * SQL from KPI-SQL-01 §2.1 (historical) and §2.2 (rolling 12-month).
 *
 * @param tenantId — Tenant UUID for multi-tenant filtering
 * @param patientId — Optional patient UUID to filter to a single patient
 * @param client — Optional PoolClient for testability
 * @returns Aggregated LTV stats with top 20 patients array
 */
export async function getPatientLTV(
  tenantId: string, patientId?: string, client?: PoolClient,
): Promise<PatientLTVResult> {
  const rows = await queryLTV(tenantId, patientId ?? null, client);

  return {
    totalPatients: rows.length,
    avgHistoricalLTV: avg(rows, 'historical_ltv_revenue'),
    avgRolling12mLTV: avg(rows, 'ltv_rolling_12m'),
    topPatients: rows.slice(0, 20).map(mapRow),
  };
}
