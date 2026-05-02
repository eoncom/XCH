import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement (VIEWER)
 *
 * S7 PR1 — split de rbac.spec.ts monolithique (27 tests) en 4 fichiers
 * par rôle pour faciliter review + permettre l'exécution ciblée
 * (ex: `npx playwright test rbac/rbac-viewer`).
 *
 * S7.5 PR5e — adapté à AUTH_MODEL_V2 (cf XCH_AUTH_MODEL_V2 mémoire).
 * Nathalie Rousseau (viewer@demo.fr) : READ sur ses délégations.
 * Lecture seule sur Sites/Assets/Tasks (pas de boutons CUD).
 * Settings ACCESSIBLE (Profil/Sécurité/Apparence — tabs personnels
 * disponibles à tous). Users management interdit (redirige).
 */

const API_URL = () => process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

test.describe('RBAC - VIEWER Role', () => {
  test.beforeEach(async ({ loginAsViewer }) => {
    await loginAsViewer();
  });

  test('should allow read access to Sites list', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await expect(page.locator('h1:has-text("Sites")')).toBeVisible({ timeout: 5000 });
    await page.waitForLoadState('networkidle');
  });

  test('should deny create Site (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('a[href="/dashboard/sites/new"]');
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

  test('should access Settings with personal tabs only (no admin/manager tabs)', async ({ page }) => {
    // S7.5 PR5e — settings page est ACCESSIBLE aux viewers (modèle v2).
    // Voient Profil/Sécurité/Apparence. Pas de Notifications (requiert
    // isManagerOrAbove), pas de tabs admin (Tenant/SSO/Modules/etc).
    await page.goto('/dashboard/settings');
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole('tab', { name: /^Profil$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^S.curit.$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Apparence$/i })).toBeVisible();

    await expect(page.getByRole('tab', { name: /^Notifications$/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /^Tenant$/i })).not.toBeVisible();
  });

  test('should deny Users management access', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/users');
  });

  test('should allow read access to Assets', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await expect(page.locator('h1:has-text("Équipements")')).toBeVisible({ timeout: 5000 });
  });

  test('should allow read access to Tasks', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await expect(page.locator('h1:has-text("Tâches")')).toBeVisible({ timeout: 5000 });
  });

  test('should deny create Task (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    const createTaskButton = page.locator('a[href="/dashboard/tasks/new"]');
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
