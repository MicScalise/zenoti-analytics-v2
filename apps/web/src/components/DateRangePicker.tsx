// =============================================================================
// DateRangePicker.tsx — Date range filter with preset options
// Implements: REQ-UI-01 (date filtering), REQ-KPI-01 (period selection)
// =============================================================================

import { useState, useCallback } from 'react';

export type PresetPeriod = 'mtd' | 'last30d' | 'custom';

interface DateRangePickerProps {
  /** Currently selected period preset */
  period: PresetPeriod;
  /** Callback when period or dates change */
  onChange: (period: PresetPeriod, startDate?: string, endDate?: string) => void;
}

/** Returns ISO date string for start of current month. */
function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

/** Returns ISO date string for 30 days ago. */
function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

/** Returns today as ISO date string. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const PRESET_OPTIONS: { value: PresetPeriod; label: string }[] = [
  { value: 'mtd', label: 'Month to Date' },
  { value: 'last30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

/**
 * Date range picker with preset period options and custom date inputs.
 * Provides MTD, Last 30d, and Custom range options matching
 * the API contract period parameter (DD-32 §10.1).
 *
 * @param period — Currently selected preset
 * @param onChange — Callback with updated period and date range
 */
export function DateRangePicker({ period, onChange }: DateRangePickerProps) {
  const [customStart, setCustomStart] = useState(thirtyDaysAgo());
  const [customEnd, setCustomEnd] = useState(today());

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as PresetPeriod;
    if (newPeriod === 'mtd') {
      onChange('mtd', startOfMonth(), today());
    } else if (newPeriod === 'last30d') {
      onChange('last30d', thirtyDaysAgo(), today());
    } else {
      onChange('custom', customStart, customEnd);
    }
  }, [onChange, customStart, customEnd]);

  const handleCustomDateChange = useCallback(() => {
    onChange('custom', customStart, customEnd);
  }, [onChange, customStart, customEnd]);

  return (
    <div className="date-range-picker">
      <select value={period} onChange={handlePresetChange}>
        {PRESET_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {period === 'custom' && (
        <div className="date-range-picker__custom">
          <input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); handleCustomDateChange(); }} />
          <span>to</span>
          <input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); handleCustomDateChange(); }} />
        </div>
      )}
    </div>
  );
}
