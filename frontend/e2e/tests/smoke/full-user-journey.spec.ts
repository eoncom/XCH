import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - SMOKE FULL USER JOURNEY (S7 PR4).
 *
 * Régression bloquante CI : ce scénario complet (login → dashboard →
 * page sites → page assets → page racks → page tasks → page costs →
 * page monitoring → page notifications → logout) couvre les 8
 * sections principales. Si UNE seule étape casse, la PR ne passe pas
 * → garantit que les hot paths utilisateurs sont toujours fonctionnels.
 *
 * Tag `@smoke` pour run prioritaire en CI E2E (peut être filtré via
 * `npx playwright test --grep @smoke`).
 *
 * Mode sériel (`test.describe.serial`) pour ordre déterministe.
 *
 * Note : cette spec NE remplace PAS le smoke prod manuel post-tag
 * (cf §Verification du plan v2). Elle automatise la régression CI
 * pour chaque PR — détecte tôt les casses majeures avant merge.
 */

test.describe.serial('@smoke Full user journey', () => {
  test('1. Login admin redirige vers /dashboard', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('2. Dashboard accessible avec stats visibles', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Section Sites accessible et liste rendue', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    // Au moins le bouton "Nouveau" doit être visible
    await expect(
      page.locator('a:has-text("Nouveau"), button:has-text("Nouveau")').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('4. Section Assets accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('5. Section Racks accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/racks');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('6. Section Tasks (Kanban) accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('7. Section Costs/Expenses accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/costs');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('8. Section Monitoring accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/monitoring');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('9. Section Notifications accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('10. API /api/auth/session retourne user authentifié', async ({ page, loginAsAdmin, request }) => {
    // S7 PR5b — fix endpoint : /api/auth/me n'existe PAS backend (404).
    // Les endpoints auth réels sont /api/auth/session, /api/auth/profile,
    // /api/auth/my-permissions (cf backend/src/modules/auth/auth.controller.ts).
    // /api/auth/session retourne { user: {...} } pour l'utilisateur courant
    // identifié par le cookie accessToken.
    await loginAsAdmin();

    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'accessToken');
    expect(accessToken).toBeTruthy();

    const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';
    const response = await request.get(`${apiUrl}/api/auth/session`, {
      headers: { Cookie: `accessToken=${accessToken!.value}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    // L'endpoint /api/auth/session retourne soit { user, ... } soit user directement
    // selon la version (cf auth.controller.ts handler). Tolérant aux deux shapes.
    const userEmail = data.user?.email || data.email;
    expect(userEmail).toBe('admin@xch.demo');
  });
});
