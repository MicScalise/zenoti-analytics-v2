// =============================================================================
// Audit Routes — Extraction and program run endpoints
// Implements: DD-32 §12 (audit endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import {
  startExtractionRun, completeExtractionRun, failExtractionRun,
  startProgramRun, completeProgramRun, failProgramRun
} from './services/audit-service.js';

export const auditRouter: Router = Router();

/** Only owner/admin can view audit data */
const AUDIT_ROLES = ['owner', 'admin'];

/** POST /audit/extraction-runs — start extraction run */
auditRouter.post('/audit/extraction-runs', async (req: Request, res: Response) => {
  if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Owner or admin required' } });
  }
  if (!req.body.entityType || typeof req.body.entityType !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'entityType required' } });
  }

  const result = await startExtractionRun(
    req.user.tid, req.body.centerId ?? null, req.body.entityType
  );
  return res.status(201).json({ success: true, data: { extractionRunId: result.extractionRunId, status: 'running' } });
});

/** POST /audit/extraction-runs/:runId/complete — complete extraction run */
auditRouter.post('/audit/extraction-runs/:runId/complete', async (req: Request, res: Response) => {
  if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Owner or admin required' } });
  }
  if (typeof req.body.recordsFetched !== 'number' || typeof req.body.recordsLoaded !== 'number') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'recordsFetched and recordsLoaded required' } });
  }

  const result = await completeExtractionRun(
    req.params.runId, req.user.tid,
    req.body.recordsFetched, req.body.recordsLoaded,
    req.body.sourceFilePath ?? null, req.body.checksumSha256 ?? null
  );
  if (!result) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Extraction run not found' } });
  }
  return res.status(200).json({ success: true, data: result });
});

/** POST /audit/extraction-runs/:runId/fail — fail extraction run */
auditRouter.post('/audit/extraction-runs/:runId/fail', async (req: Request, res: Response) => {
  if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Owner or admin required' } });
  }
  await failExtractionRun(req.params.runId, req.body.errorMessage ?? 'Unknown error', req.user.tid);
  return res.status(200).json({ success: true, data: { status: 'failed' } });
});

/** POST /audit/program-runs — start program run */
auditRouter.post('/audit/program-runs', async (req: Request, res: Response) => {
  if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Owner or admin required' } });
  }
  if (!req.body.programName) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'programName required' } });
  }
  const result = await startProgramRun(
    req.body.programName, req.body.args ?? {}, req.user.tid
  );
  return res.status(201).json({ success: true, data: { programRunId: result.programRunId, status: 'running' } });
});

/** POST /audit/program-runs/:runId/complete — complete program run */
auditRouter.post('/audit/program-runs/:runId/complete', async (req: Request, res: Response) => {
  if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Owner or admin required' } });
  }
  const result = await completeProgramRun(
    parseInt(req.params.runId), req.body.outputSummary ?? {}, req.user.tid
  );
  if (!result) {
    return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Program run not found' } });
  }
  return res.status(200).json({ success: true, data: result });
});

/** POST /audit/program-runs/:runId/fail — fail program run */
auditRouter.post('/audit/program-runs/:runId/fail', async (req: Request, res: Response) => {
  if (!req.user || !AUDIT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Owner or admin required' } });
  }
  await failProgramRun(
    parseInt(req.params.runId),
    req.body.errorClass ?? 'OUR_BUG',
    req.body.errorCode ?? 'UNKNOWN',
    req.body.errorMessage ?? 'Unknown error',
    req.user.tid
  );
  return res.status(200).json({ success: true, data: { status: 'failed' } });
});
