// =============================================================================
// Patients Routes — GET/POST/PATCH patients
// Implements: DD-32 §6 (patient management endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import {
  createPatient, getPatientById, updatePatient, archivePatient, searchPatients
} from './services/patient-service.js';
import { validateCreatePatient, validateUpdatePatient, validatePatientSearch } from './validators.js';

export const patientsRouter: Router = Router();

/** Allowed roles for patient access (DD-32 §6.1) */
const PATIENT_ROLES = ['admin', 'clinical', 'staff', 'readonly'];
const WRITE_ROLES = ['admin', 'clinical'];

function checkAuth(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Auth required' } });
    return false;
  }
  if (!PATIENT_ROLES.includes(req.user.role)) {
    res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
    return false;
  }
  return true;
}

/** GET /patients — list/search patients */
patientsRouter.get('/patients', async (req: Request, res: Response) => {
  if (!checkAuth(req, res)) return;
  const tid = req.user!.tid;

  if (req.query.search) {
    const errors = validatePatientSearch(req.query);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const pattern = `%${(req.query.search as string).replace(/[%_]/g, '\\$&')}%`;
    const patients = await searchPatients(tid, pattern, limit, offset);
    return res.status(200).json({ success: true, data: patients });
  }

  return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'search query required' } });
});

/** GET /patients/:patientId — get patient by ID */
patientsRouter.get('/patients/:patientId', async (req: Request, res: Response) => {
  if (!checkAuth(req, res)) return;
  const patient = await getPatientById(req.params.patientId, req.user!.tid);
  if (!patient) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Patient not found' } });
  }
  return res.status(200).json({ success: true, data: patient });
});

/** POST /patients — create patient */
patientsRouter.post('/patients', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateCreatePatient(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }

  const patientId = await createPatient(req.user.tid, req.user.uid, {
    zenotiPatientId: `manual-${Date.now()}`,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    dateOfBirth: req.body.dateOfBirth,
    gender: req.body.gender,
    phone: req.body.phone,
    email: req.body.email,
    locationId: req.body.locationId ?? '00000000-0000-0000-0000-000000000000',
  });

  const patient = await getPatientById(patientId, req.user.tid);
  return res.status(201).json({ success: true, data: patient });
});

/** PATCH /patients/:patientId — update patient (SCD Type 2) */
patientsRouter.patch('/patients/:patientId', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateUpdatePatient(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }

  const updated = await updatePatient(req.params.patientId, req.user.tid, req.user.uid, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Patient not found' } });
  }
  return res.status(200).json({ success: true, data: updated });
});

/** POST /patients/:patientId/archive — archive patient */
patientsRouter.post('/patients/:patientId/archive', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  await archivePatient(req.params.patientId, req.user!.tid);
  return res.status(200).json({ success: true, data: { archived: true } });
});
