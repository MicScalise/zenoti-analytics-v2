// =============================================================================
// Reporting Routes — Dashboard, revenue, retention, profitability
// Implements: DD-32 §10 (reporting & KPI endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import { getDashboard } from './services/dashboard-service.js';
import { getRevenueSummary, getRetentionCohorts, getNeuromodulatorProfitability } from './services/kpi-service.js';
import { validateDashboardQuery, validateRevenueQuery } from './validators.js';

export const reportingRouter: Router = Router();

const READ_ROLES = ['admin', 'clinical', 'staff', 'readonly'];

/** GET /dashboard/kpis — aggregated KPI dashboard */
reportingRouter.get('/dashboard/kpis', async (req: Request, res: Response) => {
  if (!req.user || !READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
  }
  const errors = validateDashboardQuery(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }

  const period = (req.query.period as string) || 'mtd';
  const dashboard = await getDashboard(
    req.user.tid, period,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  return res.status(200).json({ success: true, data: dashboard });
});

/** GET /revenue/summary — revenue summary KPIs */
reportingRouter.get('/revenue/summary', async (req: Request, res: Response) => {
  if (!req.user || !READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
  }
  const errors = validateRevenueQuery(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }

  const summary = await getRevenueSummary(
    req.user.tid,
    req.query.startDate as string,
    req.query.endDate as string,
    req.query.locationId as string | undefined,
    req.query.providerId as string | undefined,
    req.query.categoryId as string | undefined
  );
  return res.status(200).json({ success: true, data: summary });
});

/** GET /reports/retention — retention cohort data */
reportingRouter.get('/reports/retention', async (req: Request, res: Response) => {
  if (!req.user || !['admin', 'clinical', 'readonly'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
  }
  const cohorts = await getRetentionCohorts(req.user.tid);
  return res.status(200).json({ success: true, data: { cohorts } });
});

/** GET /reports/neuromodulator-profitability — neuromodulator profitability */
reportingRouter.get('/reports/neuromodulator-profitability', async (req: Request, res: Response) => {
  if (!req.user || !['admin', 'clinical'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  if (!req.query.startDate || !req.query.endDate) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'startDate and endDate required' } });
  }
  const data = await getNeuromodulatorProfitability(
    req.user.tid, req.query.startDate as string, req.query.endDate as string
  );
  return res.status(200).json({ success: true, data });
});
