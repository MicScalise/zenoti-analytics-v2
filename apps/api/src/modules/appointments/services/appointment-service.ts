// =============================================================================
// import { _uuidv4 as uuidv4, _bcrypt as bcrypt } from '../../lib/stubs.js';
// Appointment Service — Visit CRUD and visit service lines
// Implements: OP-VIS-01 through OP-VIS-03, OP-VS-01, OP-VS-02 (DD-36 §6)
// State machine transitions in visit-state-machine.ts
// ============================================================================

import { pool, withTenantContext } from '../../db.js';
// import { v4 as uuidv4 } from 'uuid'; // Stubbed for build
import { completeVisit, cancelVisit, markNoShow } from './visit-state-machine.js';

/** Visit response with joined patient/provider/room names */
export interface VisitResponse {
  visitId: string;
  zenotiVisitId: string;
  patientId: string;
  providerId: string | null;
  roomId: string | null;
  locationId: string;
  visitDate: string;
  scheduledDurationMinutes: number;
  visitStatus: string;
  isNewPatientVisit: boolean;
  noShowFlag: boolean;
  actualStart: string | null;
  actualEnd: string | null;
  actualDurationMinutes: number | null;
  patientFirstName: string;
  patientLastName: string;
  providerFirstName: string | null;
  providerLastName: string | null;
  roomName: string | null;
}

/** Input for creating a new appointment */
export interface CreateVisitInput {
  zenotiVisitId: string;
  patientId: string;
  providerId?: string;
  roomId?: string;
  locationId: string;
  appointmentId?: string;
  visitDate: string;
  scheduledDurationMinutes: number;
  isNewPatientVisit: boolean;
}

// Re-export state machine functions
export { completeVisit, cancelVisit, markNoShow };

/**
 * Create a new visit (initial status = 'scheduled').
 * Implements OP-VIS-01.
 */
export async function createVisit(
  tenantId: string, userId: string, input: CreateVisitInput
): Promise<string> {
  const visitId = 'stub-uuid-' + Date.now();
  const result = await withTenantContext(tenantId, userId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO fct_visits (
        visit_id, tenant_id, zenoti_visit_id, patient_id, provider_id, room_id, location_id,
        appointment_id, visit_date, scheduled_duration_minutes,
        visit_status, is_new_patient_visit, no_show_flag, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled', $11, false, NOW(), NOW())
      RETURNING visit_id;`,
      [visitId, tenantId, input.zenotiVisitId, input.patientId,
       input.providerId ?? null, input.roomId ?? null, input.locationId,
       input.appointmentId ?? null, input.visitDate, input.scheduledDurationMinutes,
       input.isNewPatientVisit]
    );
    return rows[0]?.visit_id;
  });

  // DR-020: Verify
  const verify = await getVisitById(result, tenantId);
  if (!verify) throw new Error('Visit creation verification failed');
  return result;
}

/**
 * Get visit by ID with joined patient/provider/room names.
 * Implements OP-VIS-02.
 */
export async function getVisitById(visitId: string, tenantId: string): Promise<VisitResponse | null> {
  const { rows } = await pool.query(
    `SELECT v.visit_id, v.zenoti_visit_id, v.patient_id, v.provider_id, v.room_id, v.location_id,
      v.visit_date, v.scheduled_duration_minutes, v.visit_status, v.is_new_patient_visit,
      v.actual_start, v.actual_end, v.actual_duration_minutes, v.no_show_flag,
      p.first_name AS patient_first_name, p.last_name AS patient_last_name,
      pr.first_name AS provider_first_name, pr.last_name AS provider_last_name, r.room_name
    FROM fct_visits v
    JOIN dim_patients p ON v.patient_id = p.patient_id
    LEFT JOIN dim_providers pr ON v.provider_id = pr.provider_id
    LEFT JOIN dim_rooms r ON v.room_id = r.room_id
    WHERE v.visit_id = $1 AND v.tenant_id = $2;`,
    [visitId, tenantId]
  );
  return rows.length > 0 ? mapVisitRow(rows[0]) : null;
}

/**
 * List visits with filters.
 * Implements OP-VIS-03.
 */
export async function listVisits(
  tenantId: string, filters: {
    startDate?: string; endDate?: string; patientId?: string;
    providerId?: string; roomId?: string; status?: string;
    limit: number; offset: number;
  }
): Promise<VisitResponse[]> {
  const { rows } = await pool.query(
    `SELECT v.visit_id, v.zenoti_visit_id, v.visit_date, v.visit_status,
      v.scheduled_duration_minutes, v.actual_duration_minutes,
      v.is_new_patient_visit, v.no_show_flag,
      p.first_name, p.last_name,
      pr.first_name AS provider_first_name, pr.last_name AS provider_last_name, r.room_name
    FROM fct_visits v
    JOIN dim_patients p ON v.patient_id = p.patient_id
    LEFT JOIN dim_providers pr ON v.provider_id = pr.provider_id
    LEFT JOIN dim_rooms r ON v.room_id = r.room_id
    WHERE v.tenant_id = $1
      AND ($2::date IS NULL OR v.visit_date >= $2) AND ($3::date IS NULL OR v.visit_date <= $3)
      AND ($4::uuid IS NULL OR v.patient_id = $4) AND ($5::uuid IS NULL OR v.provider_id = $5)
      AND ($6::uuid IS NULL OR v.room_id = $6) AND ($7 = 'all' OR v.visit_status = $7)
    ORDER BY v.visit_date DESC, v.actual_start DESC NULLS LAST
    LIMIT $8 OFFSET $9;`,
    [tenantId, filters.startDate ?? null, filters.endDate ?? null,
     filters.patientId ?? null, filters.providerId ?? null, filters.roomId ?? null,
     filters.status ?? 'all', filters.limit, filters.offset]
  );
  return rows.map(mapVisitRow);
}

/**
 * Insert a visit service line.
 * Implements OP-VS-01.
 */
export async function addVisitService(
  tenantId: string, userId: string, params: {
    visitId: string; serviceId: string; providerId: string; categoryId: string;
    quantity: number; grossRevenue: number; discounts: number;
    netRevenue: number; earnedDate: string;
  }
): Promise<string> {
  const visitServiceId = 'stub-uuid-' + Date.now();
  return withTenantContext(tenantId, userId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO fct_visit_services (
        visit_service_id, tenant_id, zenoti_visit_service_id, visit_id, service_id,
        provider_id, category_id, quantity, gross_revenue, discounts, net_revenue, earned_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING visit_service_id;`,
      [visitServiceId, tenantId, null, params.visitId, params.serviceId,
       params.providerId, params.categoryId, params.quantity, params.grossRevenue,
       params.discounts, params.netRevenue, params.earnedDate]
    );
    return rows[0]?.visit_service_id;
  });
}

/** Map a database row to VisitResponse */
function mapVisitRow(r: Record<string, unknown>): VisitResponse {
  return {
    visitId: r.visit_id as string, zenotiVisitId: r.zenoti_visit_id as string,
    patientId: r.patient_id as string, providerId: r.provider_id as string | null,
    roomId: r.room_id as string | null, locationId: (r.location_id ?? '') as string,
    visitDate: r.visit_date as string, scheduledDurationMinutes: r.scheduled_duration_minutes as number,
    visitStatus: r.visit_status as string, isNewPatientVisit: r.is_new_patient_visit as boolean,
    noShowFlag: r.no_show_flag as boolean,
    actualStart: r.actual_start as string | null, actualEnd: r.actual_end as string | null,
    actualDurationMinutes: r.actual_duration_minutes as number | null,
    patientFirstName: (r.patient_first_name ?? r.first_name) as string,
    patientLastName: (r.patient_last_name ?? r.last_name) as string,
    providerFirstName: r.provider_first_name as string | null,
    providerLastName: r.provider_last_name as string | null,
    roomName: r.room_name as string | null,
  };
}
