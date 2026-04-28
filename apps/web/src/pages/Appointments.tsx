// =============================================================================
// Appointments.tsx — Appointments view with status/date filters
// Implements: REQ-UI-01, DD-32 §7 (appointment endpoints)
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { DataTable, type Column } from '../components/DataTable.js';
import { apiClient } from '../services/api.js';

/** Appointment summary from GET /appointments (DD-32 §7.1). */
interface AppointmentSummary {
  [key: string]: unknown;
  visitId: string;
  patientName: string;
  providerName: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  serviceName: string;
}

/** Status filter options. */
const STATUS_OPTIONS = ['all', 'scheduled', 'completed', 'cancelled', 'no_show'] as const;

/**
 * Appointments page showing scheduled visits with filters.
 * Fetches from /appointments with status filter (DD-32 §7.1).
 */
export function Appointments() {
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      params.start_date = '2026-01-01';
      params.end_date = '2026-12-31';
      const { data } = await apiClient.get<{ data: AppointmentSummary[] }>('/appointments', { params });
      setAppointments(data.data || []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  if (isLoading) return <div>Loading appointments...</div>;

  return (
    <div className="page-appointments">
      <h1>Appointments</h1>
      <div className="filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <DataTable<AppointmentSummary>
        columns={[] as Column<AppointmentSummary>[]}
        data={appointments}
        hasMore={false}
        hasPrev={false}
        onNext={() => {}}
        onPrev={() => {}}
      />
    </div>
  );
}
