// =============================================================================
// test-utils.ts — Shared E2E test utilities
// Implements: EP §7, DR-042 (import from ./helpers/test-utils)
// =============================================================================

import { Page, expect } from '@playwright/test';

/** Default test user credentials for E2E login. */
const TEST_USER = {
  email: 'admin@test.zenoti-analytics.com',
  password: 'TestPass123!',
};

/** Base URL for the API server. */
const API_BASE = process.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Sets up API route mocking for E2E tests.
 * Intercepts auth and data API calls so tests don't need a live backend.
 *
 * @param page — Playwright page instance
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // Mock login endpoint
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          sessionId: 'test-session-id',
          tenantId: '00000000-0000-0000-0000-000000000001',
          user: { id: 'usr-1', email: 'admin@test.zenoti-analytics.com', role: 'admin' },
        },
      }),
    });
  });

  // Mock KPI/dashboard endpoints
  await page.route('**/api/v1/dashboard/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          kpis: [
            { key: 'totalRevenue', label: 'Total Revenue', value: 125000, changePct: 0.05, format: 'currency' },
            { key: 'totalVisits', label: 'Total Visits', value: 340, changePct: 0.02, format: 'number' },
            { key: 'avgTicketValue', label: 'Avg Ticket', value: 367, changePct: -0.01, format: 'currency' },
          ],
        },
      }),
    });
  });

  // Mock patients endpoint
  await page.route('**/api/v1/patients**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { patientId: 'p1', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', patientStatus: 'active' },
        ],
      }),
    });
  });

  // Mock inventory endpoint
  await page.route('**/api/v1/inventory**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { itemId: 'i1', productName: 'Botox 100U', productType: 'Neuromodulator', quantityOnHand: 50, defaultCost: 450, defaultPrice: 600 },
        ],
      }),
    });
  });
}

/**
 * Logs in a test user via the UI login form.
 * Waits for navigation to the dashboard after successful login.
 *
 * @param page — Playwright page instance
 * @param email — Optional override email
 * @param password — Optional override password
 */
export async function login(
  page: Page,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password,
): Promise<void> {
  // Set up API mocks before navigating
  await setupApiMocks(page);
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"], button:has-text("Login")');
  // Wait for dashboard to load after login
  await page.waitForURL('/', { timeout: 10_000 });
}

/**
 * Logs out the current user via the UI.
 * Waits for redirect to the login page.
 *
 * @param page — Playwright page instance
 */
export async function logout(page: Page): Promise<void> {
  // Click logout button in navbar/sidebar
  await page.click('[data-testid="logout"], button:has-text("Logout")');
  await page.waitForURL('/login', { timeout: 10_000 });
}

/**
 * Asserts that the page contains a KPI card with the given key.
 *
 * @param page — Playwright page instance
 * @param kpiKey — The KPI key to find (e.g., 'totalRevenue')
 */
export async function expectKPICard(page: Page, kpiKey: string): Promise<void> {
  const card = page.locator(`[data-testid="kpi-${kpiKey}"]`);
  await expect(card).toBeVisible({ timeout: 5_000 });
}

/**
 * Navigates to a page via the sidebar navigation.
 *
 * @param page — Playwright page instance
 * @param label — Nav item label (e.g., 'Patients')
 */
export async function navigateTo(page: Page, label: string): Promise<void> {
  await page.click(`.nav-item:has-text("${label}")`);
  await page.waitForLoadState('networkidle');
}

/** Returns the API base URL for direct API calls in tests. */
export function getApiBase(): string {
  return API_BASE;
}
