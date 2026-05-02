import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement (VIEWER)
 *
 * S7 PR1 — split de rbac.spec.ts monolithique (27 tests) en 4 fichiers
 * par rôle pour faciliter review + permettre l'exécution ciblée
 * (ex: `npx playwright test rbac/rbac-viewer`).
 *
 * VIEWER : lecture seule sur Sites/Assets/Tasks. Pas de Settings,
 * pas de Users management, pas de boutons CUD visibles.
 */

const API_URL = () => process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

test.describe('RBAC - VIEWER Role', () => {
  test.beforeEach(async ({ loginAsViewer }) => {
    await loginAsViewer();
  });

  test('should allow read access to Sites list', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await expect(page.locator('h1')).toContainText(/Sites/i);
    await page.waitForLoadState('networkidle');
  });

  test('should deny create Site (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("Nouveau site")');
    const buttonExists = await createButton.isVisible().catch(() => false);
    expect(buttonExists).toBe(false);
  });

  test('should deny edit Site (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/sites');

    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    const siteExists = await firstSite.isVisible().catch(() => false);

    if (siteExists) {
      await firstSite.click();
      await page.waitForURL(/\/dashboard\/sites\/[a-z0-9-]+$/);

      const editButton = page.locator('button:has-text("Modifier")');
      const editExists = await editButton.isVisible().catch(() => false);
      expect(editExists).toBe(false);
    }
  });

  test('should deny delete Site (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/sites');

    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    const siteExists = await firstSite.isVisible().catch(() => false);

    if (siteExists) {
      await firstSite.click();
      await page.waitForURL(/\/dashboard\/sites\/[a-z0-9-]+$/);

      const deleteButton = page.locator('button:has-text("Supprimer")');
      const deleteExists = await deleteButton.isVisible().catch(() => false);
      expect(deleteExists).toBe(false);
    }
  });

  test('should deny Settings access', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (!currentUrl.includes('/settings')) {
      expect(currentUrl).not.toContain('/settings');
    } else {
      await expect(page.locator('text=/403|Accès refusé|Access denied/i')).toBeVisible();
    }
  });

  test('should deny Users management access', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/users');
  });

  test('should allow read access to Assets', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await expect(page.locator('h1')).toContainText(/Assets|Équipements/i);
  });

  test('should allow read access to Tasks', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await expect(page.locator('h1')).toContainText(/Tâches|Tasks/i);
  });

  test('should deny create Task (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    const createTaskButton = page.locator('button:has-text("Nouvelle tâche")');
    const buttonExists = await createTaskButton.isVisible().catch(() => false);
    expect(buttonExists).toBe(false);
  });

  test('API should return 403 when VIEWER tries to create Site', async ({ request, page, loginAsViewer }) => {
    await loginAsViewer();

    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'accessToken');
    if (!accessToken) {
      throw new Error('No access token found');
    }

    const response = await request.post(`${API_URL()}/api/sites`, {
      headers: { Cookie: `accessToken=${accessToken.value}` },
      data: { name: 'Unauthorized Site', code: 'UNAUTH-001', type: 'TEMPORARY' },
    });

    expect(response.status()).toBe(403);
  });
});
