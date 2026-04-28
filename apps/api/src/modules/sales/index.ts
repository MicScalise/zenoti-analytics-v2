// =============================================================================
// Sales Module — Public API
// Implements: TASK-019 (module barrel export)
// ============================================================================

export { salesRouter } from './routes.js';
export {
  createPayment, getPaymentsByPatient,
  createPackageRedemption, createMembershipBilling
} from './services/sales-service.js';
export type { PaymentResponse, RedemptionResponse, MembershipBillingResponse } from './services/sales-service.js';
