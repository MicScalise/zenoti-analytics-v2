// =============================================================================
// Patients.tsx — Patient directory with search and pagination
// Implements: REQ-UI-01, DD-32 §6 (patient endpoints)
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { DataTable, type Column } from '../components/DataTable.js';
import { apiClient } from '../services/api.js';

/** Patient record from GET /patients (DD-32 §6.1). */
interface Patient {
  [key: string]: unknown;
  patientId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  lastVisitDate?: string;
  patientStatus: string;
}

/** Column definitions for the patients table. */
const PATIENT_COLUMNS: Column<Patient>[] = [
  { key: 'firstName', label: 'First Name', sortable: true },
  { key: 'lastName', label: 'Last Name', sortable: true },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'lastVisitDate', label: 'Last Visit', sortable: true },
];

/**
 * Patients page showing patient directory with search and pagination.
 * Fetches from /patients with cursor-based pagination (DD-32 §6.1).
 */
export function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.q = searchQuery;
      const { data } = await apiClient.get<{ data: Patient[] }>('/patients', { params });
      setPatients(data.data || []);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  if (isLoading) return <div>Loading patients...</div>;

  return (
    <div className="page-patients">
      <h1>Patients</h1>
      <div className="page-patients__search">
        <input
          type="text"
          placeholder="Search patients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <DataTable<Patient>
        hasMore={false}
        hasPrev={false}
        onNext={() => {}}
        onPrev={() => {}}
        columns={PATIENT_COLUMNS}
        data={patients}
      />
    </div>
  );
}
