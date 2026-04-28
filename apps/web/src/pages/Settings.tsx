// =============================================================================
// Settings.tsx — Tenant settings page
// Implements: REQ-UI-01, DD-32 §5 (tenant management)
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api.js';

/** Tenant configuration from GET /tenants/{tenantId} (DD-32 §5.2). */
interface TenantConfig {
  tenantId: string;
  tenantName: string;
  timezone: string;
  payPeriodType: string;
  payPeriodAnchorDay: number;
  billingStatus: string;
}

/**
 * Settings page for tenant configuration.
 * Calls GET /tenants/{tenantId} and PATCH /tenants/{tenantId} (DD-32 §5).
 * Only users with role='owner' can modify settings.
 */
export function Settings() {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  /** Fetch current tenant configuration. */
  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get<{ data: TenantConfig[] }>('/tenants');
      if (data.data.length > 0) {
        setConfig(data.data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /** Save updated tenant configuration. */
  const handleSave = useCallback(async (updates: Partial<TenantConfig>) => {
    if (!config) return;
    setIsSaving(true);
    try {
      await apiClient.patch(`/tenants/${config.tenantId}`, updates);
      setConfig((prev) => prev ? { ...prev, ...updates } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  if (isLoading) return <div>Loading settings…</div>;
  if (!config) return <div>No tenant configuration found.</div>;

  return (
    <div className="page-settings">
      <h2>Settings</h2>
      {error && <div className="page-settings__error">{error}</div>}
      <SettingsForm config={config} onSave={handleSave} isSaving={isSaving} />
    </div>
  );
}

/** Settings form sub-component. */
function SettingsForm({ config, onSave, isSaving }: {
  config: TenantConfig;
  onSave: (updates: Partial<TenantConfig>) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(config.tenantName);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ tenantName: name }); }}>
      <label>
        Tenant Name:
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>Timezone: <input value={config.timezone} disabled /></label>
      <label>Pay Period: <input value={config.payPeriodType} disabled /></label>
      <button type="submit" disabled={isSaving}>Save</button>
    </form>
  );
}
