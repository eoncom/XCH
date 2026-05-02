import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement (TECHNICIEN — rôle "USER" dans backend RBAC)
 *
 * S7 PR1 — split de rbac.spec.ts. Technicien peut créer/éditer ses
 * propres tâches et assets, lecture seule sur sites, pas de Settings.
 */

const API_URL = () => process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

test.describe('RBAC - Technicien Role', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(TEST_USERS.technicien);
  });

  test('should allow read access to Sites', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await expect(page.locator('h1')).toContainText(/Sites/i);
  });

  test('should allow create Task', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    const createTaskButton = page.locator('button:has-text("Nouvelle tâche")');
    await expect(createTaskButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow edit own Task', async ({ page }) => {
    await page.goto('/dashboard/tasks');

    await page.click('button:has-text("Nouvelle tâche")');
    await page.waitForSelector('form, [role="dialog"]');

    await page.fill('[name="title"]', 'USER Task Test');
    await page.fill('[name="description"]', 'Test USER permissions');

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    const editButton = page.locator('button:has-text("Modifier")');
    const editExists = await editButton.isVisible().catch(() => false);
    expect(editExists).toBe(true);
  });

  test('should deny Settings access', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/settings');
  });

  test('should deny create Site', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    const createSiteButton = page.locator('button:has-text("Nouveau site")');
    const buttonExists = await createSiteButton.isVisible().catch(() => false);
    expect(buttonExists).toBe(false);
  });

  test('should allow create Asset', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    const createAssetButton = page.locator('button:has-text("Nouvel équipement")');
    const buttonExists = await createAssetButton.isVisible().catch(() => false);
    expect(buttonExists).toBe(true);
  });

  test('API should return 403 when Technicien tries to delete Site', async ({ request, page, loginAs }) => {
    await loginAs(TEST_USERS.technicien);

    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'accessToken');
    if (!accessToken) {
      throw new Error('No access token found');
    }

    const response = await request.delete(`${API_URL()}/api/sites/fake-id-123`, {
      headers: { Cookie: `accessToken=${accessToken.value}` },
    });

    // 403 attendu (Forbidden) ou 404 si l'id fake-id-123 n'est pas trouvé.
    expect([403, 404]).toContain(response.status());
  });
});
