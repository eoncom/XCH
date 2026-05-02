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
 * Mode sériel (`test.describe.serial`) pour ordre déterministe (login
 * partagé via fixture loginAsAdmin sur chaque test mais le serial
 * garantit séquence stable des navigations).
 *
 * Validation Chrome MCP S7.5 PR5h sur xch.eoncom.io :
 * - h1 page-title classes : `text-3xl font-bold` (Sites/Assets/Racks/
 *   Tasks/Costs/Dashboard) et `text-2xl font-bold` (Surveillance/
 *   Boîte de réception). Sélecteur `h1:has-text("X")` matche les deux.
 * - Sélecteurs alpha (cf SELECTORS_STRATEGY.md zone α) : login form +
 *   sidebar nav-{slug} + logout-button.
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

  test('2. Dashboard accessible avec page heading visible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });
  });

  test('3. Section Sites accessible et liste rendue', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Sites")')).toBeVisible({ timeout: 10000 });
    // CTA "Nouveau site" est un Next.js Link
    await expect(page.locator('a[href="/dashboard/sites/new"]')).toBeVisible({ timeout: 5000 });
  });

  test('4. Section Équipements accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Équipements")')).toBeVisible({ timeout: 10000 });
  });

  test('5. Section Baies accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/racks');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Baies")')).toBeVisible({ timeout: 10000 });
  });

  test('6. Section Tâches (Kanban) accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Tâches")')).toBeVisible({ timeout: 10000 });
  });

  test('7. Section Coûts accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/costs');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Coûts")')).toBeVisible({ timeout: 10000 });
  });

  test('8. Section Surveillance (monitoring) accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/monitoring');
    await page.waitForLoadState('networkidle');

    // S7.5 PR5h — page heading réel est "Surveillance" (pas "Monitoring"
    // qui est juste le label nav). Vérifié Chrome MCP xch.eoncom.io.
    await expect(page.locator('h1:has-text("Surveillance")')).toBeVisible({ timeout: 10000 });
  });

  test('9. Section Boîte de réception (notifications) accessible', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle');

    // S7.5 PR5h — page heading réel est "Boîte de réception" (pas
    // "Notifications" qui est juste le label nav). Vérifié Chrome MCP.
    await expect(page.locator('h1:has-text("Boîte de réception")')).toBeVisible({ timeout: 10000 });
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
