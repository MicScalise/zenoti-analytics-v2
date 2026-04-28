// =============================================================================
// KPI Types — Shared types for KPI and reporting services
// Implements: TASK-021 shared interfaces
// ============================================================================

/** Revenue summary KPI result — matches DD-36 §10.1 output */
export interface RevenueSummary {
  totalRevenue: number;
  totalVisits: number;
  totalPatients: number;
  avgRevenuePerVisit: number;
  avgRevenuePerPatient: number;
  grossMargin: number;
  grossMarginPct: number;
}

/** Retention cohort result — matches DD-36 §10.2 output */
export interface RetentionCohort {
  cohortMonth: string;
  cohortSize: number;
  returned0: number;
  returned1: number;
  returned2: number;
  returned3: number;
  returned4: number;
  returned5: number;
  returned6: number;
  returned7: number;
  returned8: number;
  returned9: number;
  returned10: number;
  returned11: number;
  returned12: number;
}

/** Neuromodulator profitability result — matches DD-36 §10.3 */
export interface NeuromodulatorProfitability {
  categoryName: string;
  brandFamily: string;
  treatmentArea: string | null;
  treatmentCount: number;
  totalUnitsUsed: number;
  totalCost: number;
  totalRevenue: number;
  grossProfit: number;
  grossMarginPct: number;
}
