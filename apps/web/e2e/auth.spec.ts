// =============================================================================
// auth.spec.ts — E2E authentication tests
// Implements: REQ-SEC-02, DD-32 §4 (auth endpoints)
// Note: Imports from ./helpers/test-utils (DR-042 in registry)
// =============================================================================

import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/test-utils';

test.describe('Authentication', () => {
  test('login navigates to dashboard', async ({ page }) => {
    await login(page);
    // After login, user should see the dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('h2, .dashboard__title')).toContainText(/dashboard/i);
  });

  test('logout redirects to login page', async ({ page }) => {
    await login(page);
    await logout(page);
    // After logout, user should be on login page
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    // Visiting a protected route without auth should redirect
    await page.goto('/patients');
    await page.waitForURL('**/login**', { timeout: 5_000 });
    expect(page.url()).toContain('/login');
  });
});
