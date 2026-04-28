// =============================================================================
// Appointments Routes — Visit CRUD and state transitions
// Implements: DD-32 §7 (appointment management endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import {
  createVisit, getVisitById, listVisits,
  completeVisit, cancelVisit, markNoShow
} from './services/appointment-service.js';
import { validateCreateVisit, validateCompleteVisit } from './validators.js';

export const appointmentsRouter: Router = Router();

const READ_ROLES = ['admin', 'clinical', 'staff', 'readonly'];
const WRITE_ROLES = ['admin', 'clinical'];

/** GET /appointments — list visits with filters */
appointmentsRouter.get('/appointments', async (req: Request, res: Response) => {
  if (!req.user || !READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
  }
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const visits = await listVisits(req.user.tid, {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    patientId: req.query.patientId as string | undefined,
    providerId: req.query.providerId as string | undefined,
    roomId: req.query.roomId as string | undefined,
    status: req.query.status as string | undefined,
    limit, offset,
  });
  return res.status(200).json({ success: true, data: visits });
});

/** GET /appointments/:visitId — get visit detail */
appointmentsRouter.get('/appointments/:visitId', async (req: Request, res: Response) => {
  if (!req.user || !READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
  }
  const visit = await getVisitById(req.params.visitId, req.user.tid);
  if (!visit) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Visit not found' } });
  }
  return res.status(200).json({ success: true, data: visit });
});

/** POST /appointments — create new appointment */
appointmentsRouter.post('/appointments', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateCreateVisit(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }
  const visitId = await createVisit(req.user.tid, req.user.uid, {
    zenotiVisitId: `manual-${Date.now()}`,
    patientId: req.body.patientId,
    providerId: req.body.providerId,
    roomId: req.body.roomId,
    locationId: req.body.locationId,
    visitDate: req.body.visitDate,
    scheduledDurationMinutes: req.body.scheduledDurationMinutes,
    isNewPatientVisit: req.body.isNewPatientVisit ?? false,
  });
  const visit = await getVisitById(visitId, req.user.tid);
  return res.status(201).json({ success: true, data: visit });
});

/** POST /appointments/:visitId/complete — mark visit completed */
appointmentsRouter.post('/appointments/:visitId/complete', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateCompleteVisit(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }
  const start = new Date(req.body.actualStart);
  const end = new Date(req.body.actualEnd);
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  const ok = await completeVisit(req.params.visitId, req.user.tid, req.body.actualStart, req.body.actualEnd, duration);
  if (!ok) {
    return res.status(409).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Visit not in scheduled state' } });
  }
  const visit = await getVisitById(req.params.visitId, req.user.tid);
  return res.status(200).json({ success: true, data: visit });
});

/** POST /appointments/:visitId/cancel — cancel visit */
appointmentsRouter.post('/appointments/:visitId/cancel', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const ok = await cancelVisit(req.params.visitId, req.user.tid);
  if (!ok) {
    return res.status(409).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Visit not in scheduled state' } });
  }
  return res.status(200).json({ success: true, data: { visitId: req.params.visitId, status: 'cancelled' } });
});

/** POST /appointments/:visitId/no-show — mark no-show */
appointmentsRouter.post('/appointments/:visitId/no-show', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const ok = await markNoShow(req.params.visitId, req.user.tid);
  if (!ok) {
    return res.status(409).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Visit not in scheduled state' } });
  }
  return res.status(200).json({ success: true, data: { visitId: req.params.visitId, status: 'no_show', noShowFlag: true } });
});
