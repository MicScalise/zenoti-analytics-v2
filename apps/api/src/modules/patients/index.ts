// =============================================================================
// Patients Module — Public API
// Implements: TASK-017 (module barrel export)
// ============================================================================

export { patientsRouter } from './routes.js';
export {
  createPatient, getPatientById, getPatientByZenotiId,
  updatePatient, archivePatient, searchPatients
} from './services/patient-service.js';
export type { PatientResponse, CreatePatientInput, UpdatePatientInput } from './services/patient-service.js';
