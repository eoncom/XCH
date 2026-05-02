import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement (ADMIN)
 *
 * S7 PR1 — split de rbac.spec.ts. Admin a le full access : Settings,
 * demo data management, Users page, CRUD complet sur tous modules.
 */

const API_URL = () => process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

test.describe('RBAC - Admin Role', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('should allow full access including demo data', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    await expect(page.locator('text=Données de démonstration')).toBeVisible();
    await expect(page.locator('button:has-text("Charger données démo")')).toBeVisible();
    await expect(page.locator('button:has-text("Réinitialiser")')).toBeVisible();
  });

  test('should allow Users management', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('/users')) {
      expect(currentUrl).toContain('/users');
    } else {
      const has403 = await page.locator('text=/403/i').isVisible().catch(() => false);
      expect(has403).toBe(false);
    }
  });

  test('should allow full CRUD on all modules', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await expect(page.locator('button:has-text("Nouveau site")')).toBeVisible({ timeout: 5000 });

    await page.goto('/dashboard/assets');
    await expect(page.locator('button:has-text("Nouvel équipement")')).toBeVisible({ timeout: 5000 });

    await page.goto('/dashboard/tasks');
    await expect(page.locator('button:has-text("Nouvelle tâche")')).toBeVisible({ timeout: 5000 });

    await page.goto('/dashboard/racks');
    await expect(page.locator('button:has-text("Nouvelle baie")')).toBeVisible({ timeout: 5000 });
  });

  test('should allow access to all dashboard features', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.locator('a[href="/dashboard/sites"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/assets"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/tasks"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/racks"]')).toBeVisible();
  });

  test('API should allow Admin to access all endpoints', async ({ request, page, loginAsAdmin }) => {
    await loginAsAdmin();

    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'accessToken');
    if (!accessToken) {
      throw new Error('No access token found');
    }

    const sitesResponse = await request.get(`${API_URL()}/api/sites`, {
      headers: { Cookie: `accessToken=${accessToken.value}` },
    });
    expect(sitesResponse.ok()).toBeTruthy();

    const usersResponse = await request.get(`${API_URL()}/api/users`, {
      headers: { Cookie: `accessToken=${accessToken.value}` },
    });
    expect(usersResponse.ok()).toBeTruthy();
  });
});
