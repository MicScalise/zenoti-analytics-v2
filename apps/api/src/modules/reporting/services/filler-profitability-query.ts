// =============================================================================
// filler-profitability-query.ts — Dermal Filler Profitability + Dead Stock
// Implements: REQ-KPI-03, DD-32 §10
// SQL Source: KPI-SQL-01 §9.1 (by Line/SKU), §9.2 (by Provider), §9.3 (Dead Stock)
// =============================================================================

import { pool } from '../../db.js';
import type { PoolClient } from 'pg';

/** Filler profitability by line/SKU. */
export interface FillerProfitabilityRow {
  fillerLine: string;
  productSku: string;
  administrations: number;
  revenue: number;
  cost: number;
  grossMargin: number;
  grossMarginPct: number;
  costPerSyringe: number;
  pricePerSyringe: number;
}

/** Filler profitability by provider/treatment area. */
export interface FillerByProviderRow {
  providerName: string;
  treatmentArea: string | null;
  fillerProduct: string;
  administrations: number;
  revenue: number;
  cost: number;
  grossMargin: number;
  costPerSyringe: number;
  pricePerSyringe: number;
}

/** Dead stock row — fillers with no usage in 90 days. */
export interface FillerDeadStockRow {
  fillerLine: string;
  productSku: string;
  lotNumber: string;
  expirationDate: string;
  quantityOnHand: number;
  receivedUnitCost: number;
  onHandValue: number;
  lastUsageDate: string | null;
  daysSinceLastUse: number | null;
}

// KPI-SQL-01 §9.1 — Filler Profitability by Line and SKU
const BY_SKU_SQL = `
  SELECT dii.manufacturer AS filler_line, dii.product_name AS product_sku,
    COUNT(DISTINCT iu.usage_id) AS administrations,
    SUM(COALESCE(re.earned_amount, 0)) AS revenue,
    SUM(iu.extended_cost) AS cost,
    SUM(COALESCE(re.earned_amount, 0)) - SUM(iu.extended_cost) AS gross_margin,
    ROUND((SUM(COALESCE(re.earned_amount, 0)) - SUM(iu.extended_cost))::numeric
      / NULLIF(SUM(COALESCE(re.earned_amount, 0)), 0), 4) AS gross_margin_pct,
    SUM(iu.extended_cost) / NULLIF(SUM(iu.quantity_used), 0) AS cost_per_syringe,
    SUM(COALESCE(re.earned_amount, 0)) / NULLIF(SUM(iu.quantity_used), 0) AS price_per_syringe
  FROM fct_inventory_usage iu
  JOIN dim_inventory_items dii ON dii.item_id = iu.inventory_item_id
  LEFT JOIN fct_visit_services vvs ON vvs.visit_service_id = iu.visit_service_id
  LEFT JOIN fct_revenue_events re ON re.visit_service_id = vvs.visit_service_id
  WHERE dii.product_type = 'dermal_filler' AND iu.tenant_id = $1
  GROUP BY dii.manufacturer, dii.product_name
  ORDER BY gross_margin DESC`;

// KPI-SQL-01 §9.2 — Filler Profitability by Provider and Treatment Area
const BY_PROVIDER_SQL = `
  SELECT dp.first_name || ' ' || dp.last_name AS provider_name,
    iu.treatment_area, dii.product_name AS filler_product,
    COUNT(DISTINCT iu.usage_id) AS administrations,
    SUM(COALESCE(re.earned_amount, 0)) AS revenue,
    SUM(iu.extended_cost) AS cost,
    SUM(COALESCE(re.earned_amount, 0)) - SUM(iu.extended_cost) AS gross_margin,
    SUM(iu.extended_cost) / NULLIF(SUM(iu.quantity_used), 0) AS cost_per_syringe,
    SUM(COALESCE(re.earned_amount, 0)) / NULLIF(SUM(iu.quantity_used), 0) AS price_per_syringe
  FROM fct_inventory_usage iu
  JOIN dim_inventory_items dii ON dii.item_id = iu.inventory_item_id
  JOIN fct_visit_services vvs ON vvs.visit_service_id = iu.visit_service_id
  JOIN dim_providers dp ON dp.provider_id = vvs.provider_id
  LEFT JOIN fct_revenue_events re ON re.visit_service_id = vvs.visit_service_id
  WHERE dii.product_type = 'dermal_filler' AND iu.tenant_id = $1
  GROUP BY dp.provider_id, dp.first_name, dp.last_name, iu.treatment_area, dii.product_name
  ORDER BY gross_margin DESC`;

// KPI-SQL-01 §9.3 — Filler Dead Stock (no usage in 90 days)
const DEAD_STOCK_SQL = `
  SELECT dii.manufacturer AS filler_line, dii.product_name AS product_sku,
    dil.lot_number, dil.expiration_date,
    dil.quantity_on_hand, dil.received_unit_cost,
    dil.quantity_on_hand * dil.received_unit_cost AS on_hand_value,
    MAX(iu.usage_date) AS last_usage_date,
    EXTRACT(DAY FROM CURRENT_DATE - MAX(iu.usage_date)) AS days_since_last_use
  FROM dim_inventory_lots dil
  JOIN dim_inventory_items dii ON dii.item_id = dil.item_id
  LEFT JOIN fct_inventory_usage iu ON iu.lot_id = dil.lot_id
  WHERE dii.product_type = 'dermal_filler'
    AND dil.quantity_on_hand > 0 AND dil.tenant_id = $1
  GROUP BY dii.manufacturer, dii.product_name, dil.lot_id, dil.lot_number,
    dil.expiration_date, dil.quantity_on_hand, dil.received_unit_cost
  HAVING MAX(iu.usage_date) IS NULL
    OR MAX(iu.usage_date) < CURRENT_DATE - INTERVAL '90 days'
  ORDER BY on_hand_value DESC`;

/** Filler profitability by line/SKU. KPI-SQL-01 §9.1. */
export async function getFillerProfitabilityBySku(
  tenantId: string, client?: PoolClient,
): Promise<FillerProfitabilityRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_SKU_SQL, [tenantId]);
  return rows.map((r: Record<string, unknown>) => ({
    fillerLine: r.filler_line as string, productSku: r.product_sku as string,
    administrations: Number(r.administrations), revenue: Number(r.revenue),
    cost: Number(r.cost), grossMargin: Number(r.gross_margin),
    grossMarginPct: Number(r.gross_margin_pct),
    costPerSyringe: Number(r.cost_per_syringe), pricePerSyringe: Number(r.price_per_syringe),
  }));
}

/** Filler profitability by provider/treatment area. KPI-SQL-01 §9.2. */
export async function getFillerProfitabilityByProvider(
  tenantId: string, client?: PoolClient,
): Promise<FillerByProviderRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(BY_PROVIDER_SQL, [tenantId]);
  return rows.map((r: Record<string, unknown>) => ({
    providerName: r.provider_name as string,
    treatmentArea: r.treatment_area as string | null,
    fillerProduct: r.filler_product as string,
    administrations: Number(r.administrations), revenue: Number(r.revenue),
    cost: Number(r.cost), grossMargin: Number(r.gross_margin),
    costPerSyringe: Number(r.cost_per_syringe), pricePerSyringe: Number(r.price_per_syringe),
  }));
}

/** Filler dead stock — no usage in 90 days. KPI-SQL-01 §9.3. */
export async function getFillerDeadStock(
  tenantId: string, client?: PoolClient,
): Promise<FillerDeadStockRow[]> {
  const conn = client ?? pool;
  const { rows } = await conn.query(DEAD_STOCK_SQL, [tenantId]);
  return rows.map((r: Record<string, unknown>) => ({
    fillerLine: r.filler_line as string, productSku: r.product_sku as string,
    lotNumber: r.lot_number as string, expirationDate: r.expiration_date as string,
    quantityOnHand: Number(r.quantity_on_hand), receivedUnitCost: Number(r.received_unit_cost),
    onHandValue: Number(r.on_hand_value),
    lastUsageDate: r.last_usage_date as string | null,
    daysSinceLastUse: r.days_since_last_use ? Number(r.days_since_last_use) : null,
  }));
}
