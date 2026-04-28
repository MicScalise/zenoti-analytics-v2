// =============================================================================
// deferred-revenue-query.ts — Deferred Revenue Rollforward and Current Balance
// Implements: REQ-KPI-04, DD-32 §10.7 (GET /reports/deferred-revenue)
// SQL Source: KPI-SQL-01 §7.1 (Rollforward), §7.2 (Current Balance)
// =============================================================================

import { pool } from '../../db.js';
import type { PoolClient } from 'pg';

/** A single period in the rollforward ledger. */
export interface RollforwardRow {
  period: string;
  beginningBalance: number;
  packageCashCollected: number;
  membershipCashCollected: number;
  revenueRecognized: number;
  netChange: number;
  endingBalance: number;
}

/** Current deferred revenue balance. */
export interface DeferredBalanceRow {
  packageCashCollected: number;
  membershipCashCollected: number;
  packageRevenueRecognized: number;
  membershipRevenueRecognized: number;
  currentDeferredBalance: number;
}

// KPI-SQL-01 §7.1 — Deferred Revenue Rollforward Ledger
const ROLLFORWARD_SQL = `
  WITH package_cash AS (
    SELECT DATE_TRUNC('month', p.payment_date) AS period,
      SUM(p.amount) AS package_cash_collected
    FROM fct_payments p
    WHERE p.tender_type = 'package' AND p.tenant_id = $1
    GROUP BY DATE_TRUNC('month', p.payment_date)
  ),
  membership_cash AS (
    SELECT DATE_TRUNC('month', mb.bill_date) AS period,
      SUM(mb.amount_collected) AS membership_cash_collected
    FROM fct_membership_billing mb
    WHERE mb.tenant_id = $1
    GROUP BY DATE_TRUNC('month', mb.bill_date)
  ),
  package_redemption AS (
    SELECT DATE_TRUNC('month', pr.redemption_date) AS period,
      SUM(pr.recognized_revenue_amount) AS package_revenue_recognized
    FROM fct_package_redemptions pr
    WHERE pr.tenant_id = $1
    GROUP BY DATE_TRUNC('month', pr.redemption_date)
  ),
  all_periods AS (
    SELECT DISTINCT DATE_TRUNC('month', earned_date) AS period FROM fct_revenue_events WHERE tenant_id = $1
    UNION
    SELECT DISTINCT DATE_TRUNC('month', payment_date) FROM fct_payments WHERE tenant_id = $1
    UNION
    SELECT DISTINCT DATE_TRUNC('month', bill_date) FROM fct_membership_billing WHERE tenant_id = $1
  )
  SELECT ap.period,
    LAG(COALESCE(pc.package_cash_collected, 0) + COALESCE(mc.membership_cash_collected, 0)
      - COALESCE(pr.package_revenue_recognized, 0))
      OVER (ORDER BY ap.period) AS beginning_balance,
    COALESCE(pc.package_cash_collected, 0) AS package_cash_collected,
    COALESCE(mc.membership_cash_collected, 0) AS membership_cash_collected,
    COALESCE(pr.package_revenue_recognized, 0) AS revenue_recognized,
    COALESCE(pc.package_cash_collected, 0) + COALESCE(mc.membership_cash_collected, 0)
      - COALESCE(pr.package_revenue_recognized, 0) AS net_change,
    (LAG(COALESCE(pc.package_cash_collected, 0) + COALESCE(mc.membership_cash_collected, 0)
      - COALESCE(pr.package_revenue_recognized, 0)) OVER (ORDER BY ap.period))
    + COALESCE(pc.package_cash_collected, 0) + COALESCE(mc.membership_cash_collected, 0)
    - COALESCE(pr.package_revenue_recognized, 0) AS ending_balance
  FROM all_periods ap
  LEFT JOIN package_cash pc ON pc.period = ap.period
  LEFT JOIN membership_cash mc ON mc.period = ap.period
  LEFT JOIN package_redemption pr ON pr.period = ap.period
  ORDER BY ap.period`;

// KPI-SQL-01 §7.2 — Current Deferred Revenue Balance
const CURRENT_BALANCE_SQL = `
  WITH total_package_sales AS (
    SELECT SUM(p.amount) AS total_package_cash
    FROM fct_payments p WHERE p.tender_type = 'package' AND p.tenant_id = $1
  ),
  total_membership_billed AS (
    SELECT SUM(mb.amount_collected) AS total_membership_cash
    FROM fct_membership_billing mb WHERE mb.tenant_id = $1
  ),
  total_package_redeemed AS (
    SELECT SUM(pr.recognized_revenue_amount) AS total_revenue_recognized
    FROM fct_package_redemptions pr WHERE pr.tenant_id = $1
  ),
  total_membership_revenue AS (
    SELECT SUM(mb.amount_collected) AS total_membership_revenue
    FROM fct_membership_billing mb
    WHERE mb.coverage_period_end <= CURRENT_DATE AND mb.tenant_id = $1
  )
  SELECT
    COALESCE(tps.total_package_cash, 0) AS package_cash_collected,
    COALESCE(tmb.total_membership_cash, 0) AS membership_cash_collected,
    COALESCE(tpr.total_revenue_recognized, 0) AS package_revenue_recognized,
    COALESCE(tmr.total_membership_revenue, 0) AS membership_revenue_recognized,
    (COALESCE(tps.total_package_cash, 0) + COALESCE(tmb.total_membership_cash, 0))
      - (COALESCE(tpr.total_revenue_recognized, 0) + COALESCE(tmr.total_membership_revenue, 0))
      AS current_deferred_balance
  FROM total_package_sales tps
  CROSS JOIN total_membership_billed tmb
  CROSS JOIN total_package_redeemed tpr
  CROSS JOIN total_membership_revenue tmr`;

/** Deferred revenue rollforward ledger. KPI-SQL-01 §7.1. */
export async function getDeferredRevenueRollforward(
  tenantId: string, client?: PoolClient,
): Promise<RollforwardRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(ROLLFORWARD_SQL, [tenantId]);
  return rows.map((r: Record<string, unknown>) => ({
    period: r.period as string,
    beginningBalance: Number(r.beginning_balance ?? 0),
    packageCashCollected: Number(r.package_cash_collected),
    membershipCashCollected: Number(r.membership_cash_collected),
    revenueRecognized: Number(r.revenue_recognized),
    netChange: Number(r.net_change),
    endingBalance: Number(r.ending_balance ?? 0),
  }));
}

/** Current deferred revenue balance. KPI-SQL-01 §7.2. */
export async function getCurrentDeferredBalance(
  tenantId: string, client?: PoolClient,
): Promise<DeferredBalanceRow> {
  const conn = client ?? pool;
  const { rows } = await conn.query(CURRENT_BALANCE_SQL, [tenantId]);
  const r = rows[0] ?? {};
  return {
    packageCashCollected: Number(r.package_cash_collected ?? 0),
    membershipCashCollected: Number(r.membership_cash_collected ?? 0),
    packageRevenueRecognized: Number(r.package_revenue_recognized ?? 0),
    membershipRevenueRecognized: Number(r.membership_revenue_recognized ?? 0),
    currentDeferredBalance: Number(r.current_deferred_balance ?? 0),
  };
}
