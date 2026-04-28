// =============================================================================
// patients.spec.ts — E2E patient search and detail tests
// Implements: REQ-UI-01, DD-32 §6 (patient endpoints)
// Note: Imports from ./helpers/test-utils (DR-042 in registry)
// =============================================================================

import { test, expect } from '@playwright/test';
import { login, navigateTo } from './helpers/test-utils';

test.describe('Patients', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'Patients');
  });

  test('patient list page loads', async ({ page }) => {
    await expect(page).toHaveURL('/patients');
    // Table should be visible
    await expect(page.locator('.data-table')).toBeVisible();
  });

  test('search filters patient results', async ({ page }) => {
    // Type in the search input
    const searchInput = page.locator('.page-patients__search input');
    await searchInput.fill('Smith');
    await searchInput.press('Enter');
    // Wait for results to load
    await page.waitForLoadState('networkidle');
    // Table should still be visible (may be empty for 'Smith')
    await expect(page.locator('.data-table')).toBeVisible();
  });
});
