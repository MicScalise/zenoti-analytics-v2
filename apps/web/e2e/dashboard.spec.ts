// =============================================================================
// dashboard.spec.ts — E2E dashboard tests
// Implements: REQ-UI-01, REQ-KPI-01, DD-32 §10.1
// Note: Imports from ./helpers/test-utils (DR-042 in registry)
// =============================================================================

import { test, expect } from '@playwright/test';
import { login, expectKPICard } from './helpers/test-utils';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('KPI grid renders with data from API', async ({ page }) => {
    // Dashboard should display KPI cards
    await expectKPICard(page, 'totalRevenue');
  });

  test('date range picker changes period', async ({ page }) => {
    // Select "Last 30 Days" from period dropdown
    const select = page.locator('.date-range-picker select');
    await select.selectOption('last30d');
    // Wait for KPIs to refresh
    await page.waitForLoadState('networkidle');
    // KPI cards should still be visible
    await expectKPICard(page, 'totalRevenue');
  });
});
