// =============================================================================
// Sales Routes — Payment and redemption endpoints
// Implements: DD-32 §8 (sales & revenue endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import { createPayment, getPaymentsByPatient, createPackageRedemption, createMembershipBilling } from './services/sales-service.js';
import { validateCreatePayment, validateCreateRedemption } from './validators.js';

export const salesRouter: Router = Router();

const READ_ROLES = ['admin', 'clinical', 'staff', 'readonly'];
const WRITE_ROLES = ['admin', 'clinical'];

/** GET /payments — list payments by patient */
salesRouter.get('/payments', async (req: Request, res: Response) => {
  if (!req.user || !READ_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Insufficient role' } });
  }
  const patientId = req.query.patientId as string;
  if (!patientId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'patientId query param required' } });
  }
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const payments = await getPaymentsByPatient(patientId, req.user.tid, limit, offset);
  return res.status(200).json({ success: true, data: payments });
});

/** POST /payments — create payment */
salesRouter.post('/payments', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateCreatePayment(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }
  const paymentId = await createPayment(req.user.tid, req.user.uid, {
    patientId: req.body.patientId,
    visitId: req.body.visitId,
    packageId: req.body.packageId,
    membershipId: req.body.membershipId,
    paymentDate: req.body.paymentDate,
    amount: req.body.amount,
    tenderType: req.body.tenderType,
    liabilityAccountType: req.body.liabilityAccountType,
  });
  return res.status(201).json({ success: true, data: { paymentId } });
});

/** POST /packages/redeem — create package redemption */
salesRouter.post('/packages/redeem', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  const errors = validateCreateRedemption(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors } });
  }
  const redemptionId = await createPackageRedemption(req.user.tid, req.user.uid, {
    packageId: req.body.packageId,
    patientId: req.body.patientId,
    visitServiceId: req.body.visitServiceId,
    redemptionDate: req.body.redemptionDate ?? new Date().toISOString(),
    unitsRedeemed: req.body.unitsRedeemed,
    recognizedRevenueAmount: req.body.recognizedRevenueAmount ?? 0,
  });
  return res.status(201).json({ success: true, data: { redemptionId } });
});

/** POST /memberships/bill — create membership billing */
salesRouter.post('/memberships/bill', async (req: Request, res: Response) => {
  if (!req.user || !WRITE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PRIVILEGE', message: 'Admin or clinical required' } });
  }
  if (!req.body.membershipId || !req.body.patientId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'membershipId and patientId required' } });
  }
  const billingId = await createMembershipBilling(req.user.tid, req.user.uid, {
    zenotiBillingId: req.body.zenotiBillingId ?? `manual-${Date.now()}`,
    membershipId: req.body.membershipId,
    membershipTypeId: req.body.membershipTypeId,
    patientId: req.body.patientId,
    billDate: req.body.billDate ?? new Date().toISOString(),
    amountBilled: req.body.amountBilled ?? 0,
    amountCollected: req.body.amountCollected ?? 0,
    coveragePeriodStart: req.body.coveragePeriodStart,
    coveragePeriodEnd: req.body.coveragePeriodEnd,
  });
  return res.status(201).json({ success: true, data: { billingId } });
});
