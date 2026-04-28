// =============================================================================
// import { _uuidv4 as uuidv4, _bcrypt as bcrypt } from '../../lib/stubs.js';
// Sales Service — Payments, package redemptions, membership billing
// Implements: OP-PMT-01, OP-PMT-02, OP-PKG-01, OP-MEM-01 (DD-36 §7)
// ============================================================================

import { pool, withTenantContext } from '../../db.js';
// import { v4 as uuidv4 } from 'uuid'; // Stubbed
import type { PaymentResponse, RedemptionResponse, MembershipBillingResponse } from './sales-types.js';
export type { PaymentResponse, RedemptionResponse, MembershipBillingResponse } from './sales-types.js';

/**
 * Insert payment record.
 * Implements OP-PMT-01.
 */
export async function createPayment(
  tenantId: string, userId: string, input: {
    zenotiPaymentId?: string; patientId: string;
    visitId?: string; packageId?: string; membershipId?: string;
    paymentDate: string; amount: number;
    tenderType: string; liabilityAccountType: string;
  }
): Promise<string> {
  const paymentId = 'stub-uuid-' + Date.now();
  const result = await withTenantContext(tenantId, userId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO fct_payments (
        payment_id, tenant_id, zenoti_payment_id, patient_id,
        visit_id, package_id, membership_id,
        payment_date, amount, tender_type, liability_account_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING payment_id;`,
      [paymentId, tenantId, input.zenotiPaymentId ?? null, input.patientId,
       input.visitId ?? null, input.packageId ?? null, input.membershipId ?? null,
       input.paymentDate, input.amount, input.tenderType, input.liabilityAccountType]
    );
    return rows[0]?.payment_id;
  });

  // DR-020: Verify insert
  const verify = await pool.query(
    `SELECT payment_id FROM fct_payments WHERE payment_id = $1 AND tenant_id = $2;`,
    [result, tenantId]
  );
  if (verify.rows.length === 0) throw new Error('Payment creation verification failed');
  return result;
}

/**
 * Get payments by patient.
 * Implements OP-PMT-02.
 */
export async function getPaymentsByPatient(
  patientId: string, tenantId: string, limit: number, offset: number
): Promise<PaymentResponse[]> {
  const { rows } = await pool.query(
    `SELECT p.payment_id, p.zenoti_payment_id, p.payment_date, p.amount,
      p.tender_type, p.liability_account_type, v.visit_id, v.visit_date,
      pat.first_name, pat.last_name
    FROM fct_payments p
    JOIN dim_patients pat ON p.patient_id = pat.patient_id
    LEFT JOIN fct_visits v ON p.visit_id = v.visit_id
    WHERE p.patient_id = $1 AND p.tenant_id = $2
    ORDER BY p.payment_date DESC LIMIT $3 OFFSET $4;`,
    [patientId, tenantId, limit, offset]
  );
  return rows.map((r: Record<string, unknown>) => ({
    paymentId: r.payment_id as string, zenotiPaymentId: r.zenoti_payment_id as string | null,
    patientId, visitId: r.visit_id as string | null, paymentDate: r.payment_date as string,
    amount: Number(r.amount), tenderType: r.tender_type as string,
    liabilityAccountType: r.liability_account_type as string,
  }));
}

/**
 * Insert package redemption.
 * Implements OP-PKG-01.
 */
export async function createPackageRedemption(
  tenantId: string, userId: string, input: {
    zenotiRedemptionId?: string; packageId: string; patientId: string;
    visitServiceId: string; redemptionDate: string;
    unitsRedeemed: number; recognizedRevenueAmount: number;
  }
): Promise<string> {
  const redemptionId = 'stub-uuid-' + Date.now();
  const result = await withTenantContext(tenantId, userId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO fct_package_redemptions (
        redemption_id, tenant_id, zenoti_redemption_id, package_id, patient_id,
        visit_service_id, redemption_date, units_redeemed, recognized_revenue_amount, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING redemption_id;`,
      [redemptionId, tenantId, input.zenotiRedemptionId ?? null,
       input.packageId, input.patientId, input.visitServiceId,
       input.redemptionDate, input.unitsRedeemed, input.recognizedRevenueAmount]
    );
    return rows[0]?.redemption_id;
  });
  // DR-020: Verify
  const verify = await pool.query(
    `SELECT redemption_id FROM fct_package_redemptions WHERE redemption_id = $1 AND tenant_id = $2;`,
    [result, tenantId]
  );
  if (verify.rows.length === 0) throw new Error('Redemption creation verification failed');
  return result;
}

/**
 * Insert membership billing record.
 * Implements OP-MEM-01.
 */
export async function createMembershipBilling(
  tenantId: string, userId: string, input: {
    zenotiBillingId: string; membershipId: string; membershipTypeId: string;
    patientId: string; billDate: string; amountBilled: number;
    amountCollected: number; coveragePeriodStart: string; coveragePeriodEnd: string;
  }
): Promise<string> {
  const billingId = 'stub-uuid-' + Date.now();
  const result = await withTenantContext(tenantId, userId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO fct_membership_billing (
        billing_id, tenant_id, zenoti_billing_id, membership_id, membership_type_id,
        patient_id, bill_date, amount_billed, amount_collected,
        coverage_period_start, coverage_period_end, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING billing_id;`,
      [billingId, tenantId, input.zenotiBillingId, input.membershipId,
       input.membershipTypeId, input.patientId, input.billDate,
       input.amountBilled, input.amountCollected,
       input.coveragePeriodStart, input.coveragePeriodEnd]
    );
    return rows[0]?.billing_id;
  });
  // DR-020: Verify
  const verify = await pool.query(
    `SELECT billing_id FROM fct_membership_billing WHERE billing_id = $1 AND tenant_id = $2;`,
    [result, tenantId]
  );
  if (verify.rows.length === 0) throw new Error('Membership billing verification failed');
  return result;
}
