// =============================================================================
// Visit State Machine — SM-VIS-01 transition helpers
// Implements: OP-VIS-04 (complete), OP-VIS-05 (cancel), OP-VIS-06 (no_show)
// Extracted from appointment-service.ts per 150-line rule
// ============================================================================

import { pool } from '../../db.js';

/** Allowed transitions per SM-VIS-01 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/**
 * Complete visit (scheduled → completed).
 * Implements OP-VIS-04. SM-VIS-01: only from 'scheduled'.
 *
 * @param visitId — visit UUID
 * @param tenantId — tenant UUID
 * @param actualStart — actual start timestamp
 * @param actualEnd — actual end timestamp
 * @param actualDurationMinutes — computed duration
 * @returns true if transition succeeded
 */
export async function completeVisit(
  visitId: string, tenantId: string,
  actualStart: string, actualEnd: string, actualDurationMinutes: number
): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE fct_visits
    SET visit_status = 'completed', actual_start = $3, actual_end = $4,
        actual_duration_minutes = $5, updated_at = NOW()
    WHERE visit_id = $1 AND tenant_id = $2 AND visit_status = 'scheduled'
    RETURNING visit_id;`,
    [visitId, tenantId, actualStart, actualEnd, actualDurationMinutes]
  );
  return rows.length > 0;
}

/**
 * Cancel visit (scheduled → cancelled).
 * Implements OP-VIS-05. SM-VIS-01: only from 'scheduled'.
 */
export async function cancelVisit(visitId: string, tenantId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE fct_visits SET visit_status = 'cancelled', updated_at = NOW()
     WHERE visit_id = $1 AND tenant_id = $2 AND visit_status = 'scheduled'
     RETURNING visit_id;`,
    [visitId, tenantId]
  );
  return rows.length > 0;
}

/**
 * Mark no-show (scheduled → no_show).
 * Implements OP-VIS-06. SM-VIS-01: only from 'scheduled'.
 */
export async function markNoShow(visitId: string, tenantId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE fct_visits SET visit_status = 'no_show', no_show_flag = true, updated_at = NOW()
     WHERE visit_id = $1 AND tenant_id = $2 AND visit_status = 'scheduled'
     RETURNING visit_id;`,
    [visitId, tenantId]
  );
  return rows.length > 0;
}

/**
 * Validate a state transition is allowed per SM-VIS-01.
 *
 * @param currentStatus — current visit_status
 * @param targetStatus — desired new status
 * @returns true if transition is valid
 */
export function isValidTransition(currentStatus: string, targetStatus: string): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}
