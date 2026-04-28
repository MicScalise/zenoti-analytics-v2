// =============================================================================
// Patient SCD Type 2 Helpers — SCD versioning operations
// Implements: OP-PAT-04 Step 1 & 2 (close current + insert new version)
// Extracted from patient-service.ts per 150-line rule
// ============================================================================

import { PoolClient } from 'pg';

/** Fields preserved across SCD version transitions */
export interface SCDPatientFields {
  zenotiPatientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  patientStatus: string;
  firstVisitDate: string | null;
}

/**
 * Close the current SCD version of a patient record.
 * OP-PAT-04 Step 1: Set effective_end to yesterday.
 *
 * @param client — transaction client
 * @param patientId — patient UUID
 * @param tenantId — tenant UUID
 */
export async function closeCurrentVersion(
  client: PoolClient, patientId: string, tenantId: string
): Promise<void> {
  await client.query(
    `UPDATE dim_patients
     SET effective_end = CURRENT_DATE - INTERVAL '1 day', updated_at = NOW()
     WHERE patient_id = $1 AND tenant_id = $2 AND effective_end = '2100-12-31'::DATE;`,
    [patientId, tenantId]
  );
}

/**
 * Insert a new SCD version of a patient record.
 * OP-PAT-04 Step 2: New row with effective_start = today.
 *
 * @param client — transaction client
 * @param patientId — patient UUID (same across versions)
 * @param tenantId — tenant UUID
 * @param userId — requesting user UUID
 * @param fields — merged SCD fields for the new version
 */
export async function insertNewVersion(
  client: PoolClient, patientId: string, tenantId: string,
  userId: string, fields: SCDPatientFields
): Promise<void> {
  await client.query(
    `INSERT INTO dim_patients (
      patient_id, tenant_id, zenoti_patient_id, first_name, last_name,
      date_of_birth, gender, phone, email,
      acquisition_source_id, location_id,
      first_visit_date, last_visit_date, patient_status,
      effective_start, effective_end,
      created_at, updated_at, created_by, loaded_by_program, loaded_by_version, source, source_id
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      NULL, '',
      $10, $10, $11,
      CURRENT_DATE, '2100-12-31'::DATE,
      NOW(), NOW(), $12, $13, $14, 'manual_update', $3
    );`,
    [
      patientId, tenantId, fields.zenotiPatientId,
      fields.firstName, fields.lastName,
      fields.dateOfBirth, fields.gender, fields.phone, fields.email,
      fields.firstVisitDate, fields.patientStatus,
      userId, 'api', '1.0.0'
    ]
  );
}
