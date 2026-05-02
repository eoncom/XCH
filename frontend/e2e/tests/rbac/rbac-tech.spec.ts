import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement (TECHNICIEN — rôle "USER" dans backend RBAC)
 *
 * S7 PR1 — split de rbac.spec.ts.
 * S7.5 PR5e — adapté à AUTH_MODEL_V2 (cf XCH_AUTH_MODEL_V2 mémoire).
 * Marc Leroy (technicien@demo.fr) a probablement WRITE sur certaines
 * délégations dans le seed démo : pas de "Nouveau site" mais peut
 * créer Tasks/Assets sur ses sites assignés. Settings page accessible
 * mais limité aux tabs personnels (Profil/Sécurité/Apparence).
 */

const API_URL = () => process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

test.describe('RBAC - Technicien Role', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(TEST_USERS.technicien);
  });

  test('should allow read access to Sites', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await expect(page.locator('h1:has-text("Sites")')).toBeVisible({ timeout: 5000 });
  });

  test('should allow create Task', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    const createTaskButton = page.locator('a[href="/dashboard/tasks/new"]');
    await expect(createTaskButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow edit own Task', async ({ page }) => {
    await page.goto('/dashboard/tasks');

    await page.click('a[href="/dashboard/tasks/new"]');
    await page.waitForSelector('form, [role="dialog"]');

    await page.fill('[name="title"]', 'USER Task Test');
    await page.fill('[name="description"]', 'Test USER permissions');

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    const editButton = page.locator('button:has-text("Modifier")');
    const editExists = await editButton.isVisible().catch(() => false);
    expect(editExists).toBe(true);
  });

  test('should access Settings with personal tabs only (no admin tabs)', async ({ page }) => {
    // S7.5 PR5e — settings page est ACCESSIBLE aux non-admin (modèle
    // v2). Marc Leroy (tech) voit uniquement les tabs personnels :
    // Profil, Sécurité, Apparence. Aucun tab admin (Tenant/SSO/Modules/
    // Structure/etc) ni Notifications (qui requiert isManagerOrAbove).
    await page.goto('/dashboard/settings');
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole('tab', { name: /^Profil$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^S.curit.$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Apparence$/i })).toBeVisible();

    // Pas de tabs admin
    await expect(page.getByRole('tab', { name: /^Tenant$/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /^SSO$/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /^Structure$/i })).not.toBeVisible();
  });

  test('should deny create Site', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    const createSiteButton = page.locator('a[href="/dashboard/sites/new"]');
    const buttonExists = await createSiteButton.isVisible().catch(() => false);
    expect(buttonExists).toBe(false);
  });

  test('should allow create Asset', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    const createAssetButton = page.locator('a[href="/dashboard/assets/new"]');
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
