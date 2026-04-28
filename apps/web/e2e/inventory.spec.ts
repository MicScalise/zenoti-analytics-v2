// =============================================================================
// inventory.spec.ts — E2E inventory catalog tests
// Implements: REQ-UI-01, DD-32 §9 (inventory endpoints)
// Note: Imports from ./helpers/test-utils (DR-042 in registry)
// =============================================================================

import { test, expect } from '@playwright/test';
import { login, navigateTo } from './helpers/test-utils';

test.describe('Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'Inventory');
  });

  test('inventory catalog loads', async ({ page }) => {
    await expect(page).toHaveURL('/inventory');
    // Data table should be visible
    await expect(page.locator('.data-table')).toBeVisible();
  });

  test('product table shows expected columns', async ({ page }) => {
    // Verify column headers are present
    const headers = page.locator('.data-table th');
    await expect(headers).toContainText(['Product', 'Type']);
  });
});
