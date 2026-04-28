// =============================================================================
// import { _uuidv4 as uuidv4, _bcrypt as bcrypt } from '../../lib/stubs.js';
// Patient Service — Patient CRUD with SCD Type 2 versioning
// Implements: OP-PAT-01 through OP-PAT-06 (DD-36 §5)
// ============================================================================

import { pool, withTenantContext } from '../../db.js';
// import { v4 as uuidv4 } from 'uuid'; // Stubbed
import { closeCurrentVersion, insertNewVersion, SCDPatientFields } from './patient-scd.js';

/** Patient response — matches dim_patients columns, DR-029 safe */
export interface PatientResponse {
  patientId: string;
  tenantId: string;
  zenotiPatientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  patientStatus: string;
  firstVisitDate: string | null;
  lastVisitDate: string | null;
}

/** Input for creating a new patient */
export interface CreatePatientInput {
  zenotiPatientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  acquisitionSourceId?: string;
  locationId: string;
}

/** Input for updating a patient (triggers SCD Type 2 versioning) */
export interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  gender?: string;
  phone?: string;
  email?: string;
  patientStatus?: string;
}

/**
 * Create a new patient (inserts current SCD version).
 * Implements OP-PAT-01.
 */
export async function createPatient(
  tenantId: string, userId: string, input: CreatePatientInput
): Promise<string> {
  const patientId = 'stub-uuid-' + Date.now();
  const firstVisitDate = new Date().toISOString().split('T')[0];

  await withTenantContext(tenantId, userId, async (client) => {
    await client.query(
      `INSERT INTO dim_patients (
        patient_id, tenant_id, zenoti_patient_id, first_name, last_name,
        date_of_birth, gender, phone, email,
        acquisition_source_id, location_id,
        first_visit_date, last_visit_date, patient_status,
        effective_start, effective_end,
        created_at, updated_at, created_by, loaded_by_program, loaded_by_version, source, source_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $12, 'active', CURRENT_DATE, '2100-12-31'::DATE,
        NOW(), NOW(), $13, $14, $15, 'manual', $3
      ) RETURNING patient_id;`,
      [
        patientId, tenantId, input.zenotiPatientId, input.firstName, input.lastName,
        input.dateOfBirth ?? null, input.gender ?? null, input.phone ?? null, input.email ?? null,
        input.acquisitionSourceId ?? null, input.locationId, firstVisitDate,
        userId, 'api', '1.0.0'
      ]
    );
  });

  // DR-020: Verify insert
  const verify = await getPatientById(patientId, tenantId);
  if (!verify) throw new Error('Patient creation verification failed');
  return patientId;
}

/**
 * Get current patient by ID (current SCD version only).
 * Implements OP-PAT-02.
 */
export async function getPatientById(patientId: string, tenantId: string): Promise<PatientResponse | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dim_patients
     WHERE patient_id = $1 AND tenant_id = $2 AND effective_end = '2100-12-31'::DATE;`,
    [patientId, tenantId]
  );
  return rows.length > 0 ? mapPatientRow(rows[0]) : null;
}

/**
 * Get patient by Zenoti ID (for deduplication).
 * Implements OP-PAT-03.
 */
export async function getPatientByZenotiId(tenantId: string, zenotiPatientId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT patient_id FROM dim_patients
     WHERE tenant_id = $1 AND zenoti_patient_id = $2 AND effective_end = '2100-12-31'::DATE;`,
    [tenantId, zenotiPatientId]
  );
  return rows.length > 0 ? rows[0].patient_id : null;
}

/**
 * Update patient — SCD Type 2: close current version, insert new.
 * Implements OP-PAT-04. Delegates to patient-scd.ts helpers.
 */
export async function updatePatient(
  patientId: string, tenantId: string, userId: string, input: UpdatePatientInput
): Promise<PatientResponse | null> {
  const current = await getPatientById(patientId, tenantId);
  if (!current) return null;

  const fields: SCDPatientFields = {
    zenotiPatientId: current.zenotiPatientId,
    firstName: input.firstName ?? current.firstName,
    lastName: input.lastName ?? current.lastName,
    dateOfBirth: current.dateOfBirth,
    gender: input.gender ?? current.gender,
    phone: input.phone ?? current.phone,
    email: input.email ?? current.email,
    patientStatus: input.patientStatus ?? current.patientStatus,
    firstVisitDate: current.firstVisitDate,
  };

  await withTenantContext(tenantId, userId, async (client) => {
    await closeCurrentVersion(client, patientId, tenantId);
    await insertNewVersion(client, patientId, tenantId, userId, fields);
  });

  // DR-020: Verify new version
  return getPatientById(patientId, tenantId);
}

/**
 * Archive patient (soft delete — close SCD version).
 * Implements OP-PAT-05.
 */
export async function archivePatient(patientId: string, tenantId: string): Promise<void> {
  await pool.query(
    `UPDATE dim_patients SET effective_end = CURRENT_DATE, updated_at = NOW()
     WHERE patient_id = $1 AND tenant_id = $2 AND effective_end = '2100-12-31'::DATE;`,
    [patientId, tenantId]
  );
}

/**
 * Search patients by name/email/phone partial match.
 * Implements OP-PAT-06.
 */
export async function searchPatients(
  tenantId: string, pattern: string, limit: number, offset: number
): Promise<PatientResponse[]> {
  const { rows } = await pool.query(
    `SELECT p.* FROM dim_patients p
     WHERE p.tenant_id = $1 AND p.effective_end = '2100-12-31'::DATE
       AND (LOWER(p.first_name) LIKE LOWER($2) OR LOWER(p.last_name) LIKE LOWER($2)
         OR p.email LIKE $2 OR p.phone LIKE $2)
     ORDER BY p.last_name, p.first_name LIMIT $3 OFFSET $4;`,
    [tenantId, pattern, limit, offset]
  );
  return rows.map(mapPatientRow);
}

/** Map a database row to a PatientResponse */
function mapPatientRow(r: Record<string, unknown>): PatientResponse {
  return {
    patientId: r.patient_id as string, tenantId: r.tenant_id as string,
    zenotiPatientId: r.zenoti_patient_id as string,
    firstName: r.first_name as string, lastName: r.last_name as string,
    dateOfBirth: r.date_of_birth as string | null, gender: r.gender as string | null,
    phone: r.phone as string | null, email: r.email as string | null,
    patientStatus: r.patient_status as string,
    firstVisitDate: r.first_visit_date as string | null,
    lastVisitDate: r.last_visit_date as string | null,
  };
}
