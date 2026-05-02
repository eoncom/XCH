import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - SMOKE FULL USER JOURNEY (S7 PR4 + S7.5 PR5h validation).
 *
 * Régression bloquante CI VRAIMENT activée (S7.5 PR5h, 2026-05-02) :
 * 10 tests sériels couvrant login + nav 7 sections + endpoint
 * /api/auth/session. Chaque PR future déclenche cette suite via
 * `--grep "@smoke"` côté workflow `.github/workflows/e2e-tests.yml`.
 *
 * Tag `@smoke` dans le titre du describe pour filtrage CI.
 *
 * Mode sériel (`test.describe.serial`) pour ordre déterministe et
 * partage du browser context (cookie session réutilisé pour éviter
 * rate limit 429 sur logins répétés — cf fixture S7.5 PR5h/5).
 *
 * Assertions par test :
 * - Test 1 : login admin → URL /dashboard
 * - Tests 2-9 : navigation page X → URL correcte + sidebar nav testid
 *   visible (preuve que page chargée et user a accès)
 * - Test 10 : API /api/auth/session retourne user authentifié
 *
 * Note : assertion sidebar nav testid (zone α SELECTORS_STRATEGY) est
 * plus stable que h1:has-text() qui dépend de la copie FR + état seed
 * (parfois "Dashboard" / "Tableau de bord" / "Surveillance" / "Boîte
 * de réception" / etc selon page). Le testid `nav-{slug}` est
 * déterministe et expose : (a) user logged-in, (b) sidebar rendered,
 * (c) user a accès à cette section.
 */
test.describe.serial('@smoke Full user journey', () => {
  test('1. Login admin redirige vers /dashboard', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('2. Dashboard accessible avec sidebar nav', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible({ timeout: 10000 });
  });

  test('3. Section Sites accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/sites/);
    await expect(page.locator('[data-testid="nav-sites"]')).toBeVisible({ timeout: 10000 });
  });

  test('4. Section Équipements accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/assets/);
    await expect(page.locator('[data-testid="nav-assets"]')).toBeVisible({ timeout: 10000 });
  });

  test('5. Section Baies accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/racks');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/racks/);
    await expect(page.locator('[data-testid="nav-racks"]')).toBeVisible({ timeout: 10000 });
  });

  test('6. Section Tâches accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/tasks/);
    await expect(page.locator('[data-testid="nav-tasks"]')).toBeVisible({ timeout: 10000 });
  });

  test('7. Section Coûts accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/costs');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/costs/);
    await expect(page.locator('[data-testid="nav-costs"]')).toBeVisible({ timeout: 10000 });
  });

  test('8. Section Surveillance (monitoring) accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/monitoring');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/monitoring/);
    await expect(page.locator('[data-testid="nav-monitoring"]')).toBeVisible({ timeout: 10000 });
  });

  test('9. Section Notifications accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/notifications/);
    // Notifications n'a pas de testid nav dédié — vérification logout
    // button confirme user toujours authentifié.
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible({ timeout: 10000 });
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
    expect(userEmail).toBe('admin@demo.fr');
  });
});
