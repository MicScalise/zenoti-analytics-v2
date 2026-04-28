// =============================================================================
// Reporting Routes — Dashboard, revenue, retention, profitability, margins
// Implements: DD-32 §8.2, §10 (reporting & KPI endpoints)
// =============================================================================

import { Router, Request, Response } from 'express';
import { getDashboard } from './services/dashboard-service.js';
import { getRevenueSummary, getRetentionCohorts, getNeuromodulatorProfitability } from './services/kpi-service.js';
import { getPatientLTV } from './services/ltv-query.js';
import { getGrossMarginByService, getGrossMarginByCategory, getGrossMarginByProvider } from './services/gross-margin-query.js';
import { getContributionMarginByProvider, getContributionMarginPerHour, getContributionMarginByCategory } from './services/contribution-margin-query.js';
import { getConsumablesPctOverall, getConsumablesPctByCategory, getConsumablesPctByProvider } from './services/consumables-query.js';
import { getDeferredRevenueRollforward, getCurrentDeferredBalance } from './services/deferred-revenue-query.js';
import { getRevenueByHourOverall, getRevenueByHourByProvider, getRevenueByHourByCategory } from './services/revenue-by-hour-query.js';
import { getFillerProfitabilityBySku, getFillerProfitabilityByProvider, getFillerDeadStock } from './services/filler-profitability-query.js';
import { validateDashboardQuery, validateRevenueQuery } from './validators.js';

export const reportingRouter: Router = Router();

const READ_ROLES = ['admin', 'clinical', 'staff', 'readonly'];
const ADMIN_CLINICAL = ['admin', 'clinical'];

/** Auth guard helper — returns true if authorized, sends 403 if not. */
function requireRole(req: Request, res: Response, roles: string[]): boolean {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
    return false;
  }
  return true;
}

/** Date range guard — returns true if valid, sends 400 if not. */
function requireDateRange(req: Request, res: Response): boolean {
  if (!req.query.startDate || !req.query.endDate) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'startDate and endDate required' } });
    return false;
  }
  return true;
}

// --- Dashboard ---

/** GET /dashboard/kpis — aggregated KPI dashboard */
reportingRouter.get('/dashboard/kpis', async (req: Request, res: Response) => {
  if (!requireRole(req, res, READ_ROLES)) return;
  const errors = validateDashboardQuery(req.query);
  if (errors.length > 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  const period = (req.query.period as string) || 'mtd';
  const data = await getDashboard(req.user!.tid, period, req.query.startDate as string, req.query.endDate as string);
  return res.status(200).json({ success: true, data });
});

// --- Revenue ---

/** GET /revenue/summary — revenue summary KPIs. DD-32 §8.1. */
reportingRouter.get('/revenue/summary', async (req: Request, res: Response) => {
  if (!requireRole(req, res, READ_ROLES)) return;
  const errors = validateRevenueQuery(req.query);
  if (errors.length > 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  const data = await getRevenueSummary(req.user!.tid, req.query.startDate as string, req.query.endDate as string,
    req.query.locationId as string, req.query.providerId as string, req.query.categoryId as string);
  return res.status(200).json({ success: true, data });
});

/** GET /revenue/patient-ltv — patient lifetime value. DD-32 §8.2. */
reportingRouter.get('/revenue/patient-ltv', async (req: Request, res: Response) => {
  if (!requireRole(req, res, READ_ROLES)) return;
  const data = await getPatientLTV(req.user!.tid, req.query.patientId as string | undefined);
  return res.status(200).json({ success: true, data });
});

/** GET /revenue/by-hour — revenue by hour of day. DD-32 §8.1 byHourOfDay. */
reportingRouter.get('/revenue/by-hour', async (req: Request, res: Response) => {
  if (!requireRole(req, res, READ_ROLES)) return;
  const groupBy = req.query.groupBy as string;
  let data;
  if (groupBy === 'provider') data = await getRevenueByHourByProvider(req.user!.tid);
  else if (groupBy === 'category') data = await getRevenueByHourByCategory(req.user!.tid);
  else data = await getRevenueByHourOverall(req.user!.tid);
  return res.status(200).json({ success: true, data });
});

// --- Reports ---

/** GET /reports/retention — retention cohort data. DD-32 §8.3. */
reportingRouter.get('/reports/retention', async (req: Request, res: Response) => {
  if (!requireRole(req, res, READ_ROLES)) return;
  const cohorts = await getRetentionCohorts(req.user!.tid);
  return res.status(200).json({ success: true, data: { cohorts } });
});

/** GET /reports/gross-margin — gross margin by service/category/provider. */
reportingRouter.get('/reports/gross-margin', async (req: Request, res: Response) => {
  if (!requireRole(req, res, ADMIN_CLINICAL)) return;
  const groupBy = req.query.groupBy as string;
  let data;
  if (groupBy === 'category') data = await getGrossMarginByCategory(req.user!.tid);
  else if (groupBy === 'provider') data = await getGrossMarginByProvider(req.user!.tid);
  else data = await getGrossMarginByService(req.user!.tid);
  return res.status(200).json({ success: true, data });
});

/** GET /reports/contribution-margin — contribution margin by provider/hour/category. */
reportingRouter.get('/reports/contribution-margin', async (req: Request, res: Response) => {
  if (!requireRole(req, res, ADMIN_CLINICAL)) return;
  const groupBy = req.query.groupBy as string;
  let data;
  if (groupBy === 'hour') data = await getContributionMarginPerHour(req.user!.tid);
  else if (groupBy === 'category') data = await getContributionMarginByCategory(req.user!.tid);
  else data = await getContributionMarginByProvider(req.user!.tid);
  return res.status(200).json({ success: true, data });
});

/** GET /reports/consumables — consumables % of revenue. */
reportingRouter.get('/reports/consumables', async (req: Request, res: Response) => {
  if (!requireRole(req, res, ADMIN_CLINICAL)) return;
  const groupBy = req.query.groupBy as string;
  let data;
  if (groupBy === 'category') data = await getConsumablesPctByCategory(req.user!.tid);
  else if (groupBy === 'provider') data = await getConsumablesPctByProvider(req.user!.tid);
  else data = await getConsumablesPctOverall(req.user!.tid);
  return res.status(200).json({ success: true, data });
});

/** GET /reports/neuromodulator-profitability — neuromodulator profitability. */
reportingRouter.get('/reports/neuromodulator-profitability', async (req: Request, res: Response) => {
  if (!requireRole(req, res, ADMIN_CLINICAL)) return;
  if (!requireDateRange(req, res)) return;
  const data = await getNeuromodulatorProfitability(req.user!.tid, req.query.startDate as string, req.query.endDate as string);
  return res.status(200).json({ success: true, data });
});

/** GET /reports/filler-profitability — dermal filler profitability. */
reportingRouter.get('/reports/filler-profitability', async (req: Request, res: Response) => {
  if (!requireRole(req, res, ADMIN_CLINICAL)) return;
  const groupBy = req.query.groupBy as string;
  let data;
  if (groupBy === 'provider') data = await getFillerProfitabilityByProvider(req.user!.tid);
  else data = await getFillerProfitabilityBySku(req.user!.tid);
  return res.status(200).json({ success: true, data });
});

/** GET /reports/filler-dead-stock — filler dead stock analysis. */
reportingRouter.get('/reports/filler-dead-stock', async (req: Request, res: Response) => {
  if (!requireRole(req, res, ADMIN_CLINICAL)) return;
  const data = await getFillerDeadStock(req.user!.tid);
  return res.status(200).json({ success: true, data });
});

/** GET /reports/deferred-revenue — deferred revenue rollforward. */
reportingRouter.get('/reports/deferred-revenue', async (req: Request, res: Response) => {
  if (!requireRole(req, res, ADMIN_CLINICAL)) return;
  const rollforward = await getDeferredRevenueRollforward(req.user!.tid);
  const balance = await getCurrentDeferredBalance(req.user!.tid);
  return res.status(200).json({ success: true, data: { rollforward, currentBalance: balance } });
});
