// =============================================================================
// Retention Cohort Query — DD-36 §10.2 VERBATIM
// Extracted from kpi-service.ts per 150-line rule
// ============================================================================

import { pool } from '../../db.js';
import type { RetentionCohort } from './kpi-types.js';

/**
 * Get retention cohort data.
 * DD-36 §10.2 VERBATIM — Retention Cohort Query.
 *
 * @param tenantId — tenant UUID
 * @returns cohort data with month-over-month retention columns
 */
export async function getRetentionCohorts(tenantId: string): Promise<RetentionCohort[]> {
  // DD-36 §10.2 VERBATIM SQL
  const { rows } = await pool.query(
    `WITH first_visits AS (
      SELECT patient_id, DATE_TRUNC('month', MIN(visit_date)) AS cohort_month
      FROM fct_visits
      WHERE tenant_id = $1 AND visit_status = 'completed'
      GROUP BY patient_id
    ),
    monthly_activity AS (
      SELECT fv.patient_id, DATE_TRUNC('month', fv.visit_date) AS activity_month
      FROM fct_visits fv
      WHERE fv.tenant_id = $1 AND fv.visit_status = 'completed'
      GROUP BY fv.patient_id, DATE_TRUNC('month', fv.visit_date)
    )
    SELECT fv.cohort_month,
      COUNT(DISTINCT fv.patient_id) AS cohort_size,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month THEN fv.patient_id END) AS returned_0,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '1 month' THEN fv.patient_id END) AS returned_1,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '2 month' THEN fv.patient_id END) AS returned_2,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '3 month' THEN fv.patient_id END) AS returned_3,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '4 month' THEN fv.patient_id END) AS returned_4,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '5 month' THEN fv.patient_id END) AS returned_5,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '6 month' THEN fv.patient_id END) AS returned_6,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '7 month' THEN fv.patient_id END) AS returned_7,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '8 month' THEN fv.patient_id END) AS returned_8,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '9 month' THEN fv.patient_id END) AS returned_9,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '10 month' THEN fv.patient_id END) AS returned_10,
      COUNT(DISTINCT CASE WHEN ma.activity_month = fv.cohort_month + INTERVAL '11 month' THEN fv.patient_id END) AS returned_11,
      COUNT(DISTINCT CASE WHEN ma.activity_month >= fv.cohort_month + INTERVAL '11 months' THEN fv.patient_id END) AS returned_12
    FROM first_visits fv
    LEFT JOIN monthly_activity ma ON fv.patient_id = ma.patient_id
    GROUP BY fv.cohort_month
    ORDER BY fv.cohort_month DESC;`,
    [tenantId]
  );

  return rows.map((r: Record<string, unknown>) => ({
    cohortMonth: r.cohort_month as string, cohortSize: Number(r.cohort_size),
    returned0: Number(r.returned_0), returned1: Number(r.returned_1),
    returned2: Number(r.returned_2), returned3: Number(r.returned_3),
    returned4: Number(r.returned_4), returned5: Number(r.returned_5),
    returned6: Number(r.returned_6), returned7: Number(r.returned_7),
    returned8: Number(r.returned_8), returned9: Number(r.returned_9),
    returned10: Number(r.returned_10), returned11: Number(r.returned_11),
    returned12: Number(r.returned_12),
  }));
}
