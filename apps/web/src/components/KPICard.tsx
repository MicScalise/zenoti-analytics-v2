// =============================================================================
// KPICard.tsx — Single KPI display with trend indicator
// Implements: REQ-UI-01 (KPI visualization), REQ-KPI-01 (metric display)
// =============================================================================

interface KPICardProps {
  /** Unique key identifying this KPI (e.g., 'totalRevenue') */
  kpiKey: string;
  /** Human-readable label */
  label: string;
  /** Current value — number or formatted string */
  value: number | string;
  /** Percent change vs previous period (positive = up) */
  changePct?: number;
  /** Display format hint */
  format?: 'currency' | 'pct' | 'number';
}

/** Formats a value based on the format hint. */
function formatValue(value: number | string, format?: string): string {
  if (typeof value === 'string') return value;
  if (format === 'currency') return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (format === 'pct') return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString('en-US');
}

/** Returns CSS class for trend direction. */
function trendClass(changePct?: number): string {
  if (changePct === undefined) return '';
  if (changePct > 0) return 'kpi-card__trend--up';
  if (changePct < 0) return 'kpi-card__trend--down';
  return 'kpi-card__trend--flat';
}

/**
 * Displays a single KPI metric with label, value, and trend.
 * Trend arrow shows up/down/flat based on changePct.
 *
 * @param kpiKey — Identifies the KPI for data-testid
 * @param label — Display label above the value
 * @param value — The metric value
 * @param changePct — Period-over-period change percentage
 * @param format — Display format (currency, pct, number)
 */
export function KPICard({ kpiKey, label, value, changePct, format }: KPICardProps) {
  return (
    <div className="kpi-card" data-testid={`kpi-${kpiKey}`}>
      <span className="kpi-card__label">{label}</span>
      <span className="kpi-card__value">{formatValue(value, format)}</span>
      {changePct !== undefined && (
        <span className={`kpi-card__trend ${trendClass(changePct)}`}>
          {changePct > 0 ? '▲' : changePct < 0 ? '▼' : '—'}
          {' '}{Math.abs(changePct * 100).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
