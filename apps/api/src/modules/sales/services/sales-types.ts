// =============================================================================
// Sales Types — Shared types for sales module
// Implements: TASK-019 shared interfaces
// ============================================================================

/** Payment response — matches fct_payments columns */
export interface PaymentResponse {
  paymentId: string;
  zenotiPaymentId: string | null;
  patientId: string;
  visitId: string | null;
  paymentDate: string;
  amount: number;
  tenderType: string;
  liabilityAccountType: string;
}

/** Package redemption response */
export interface RedemptionResponse {
  redemptionId: string;
  packageId: string;
  patientId: string;
  redemptionDate: string;
  unitsRedeemed: number;
  recognizedRevenueAmount: number;
}

/** Membership billing response */
export interface MembershipBillingResponse {
  billingId: string;
  membershipId: string;
  membershipTypeId: string;
  patientId: string;
  billDate: string;
  amountBilled: number;
  amountCollected: number;
  coveragePeriodStart: string;
  coveragePeriodEnd: string;
}
