import { test, expect, type Cookie } from '@playwright/test';
import { TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - SMOKE FULL USER JOURNEY (S7 PR4 + S7.5 PR5h validation).
 *
 * Régression bloquante CI VRAIMENT activée (S7.5 PR5h, 2026-05-02) :
 * 10 tests sériels couvrant login + nav 7 sections + endpoint
 * /api/auth/session. Chaque PR future déclenche cette suite via
 * `--grep "@smoke"` côté workflow `.github/workflows/e2e-tests.yml`.
 *
 * S7.5 PR5h/7 — pattern storageState partagé : login UNE FOIS en
 * `test.beforeAll`, cookies réinjectés en `test.beforeEach` sur chaque
 * test's context. Évite rate limit backend 429 (10 logins serial =
 * throttled). Pattern user choice 2026-05-02 (option A).
 *
 * Auth via API direct (pas UI form) car React 18 production controlled
 * component a un timing issue : page.fill() + click submit immédiat ne
 * propage pas le state à temps → handleSubmit lit value vide → no
 * fetch. Cf retex S7.5 PR5h/4 dans XCH_PLAN_V2_FINALIZATION.
 *
 * Cookies cross-origin workaround : POST /api/auth/login va à
 * localhost:3002 (backend), Set-Cookie domain par défaut = localhost
 * (host-only). Re-set explicit avec domain=frontendUrl.hostname
 * garantit que le cookie est sent à localhost:3001 (frontend).
 *
 * Tag `@smoke` dans le titre du describe pour filtrage CI.
 *
 * Mode sériel (`test.describe.serial`) pour ordre déterministe.
 */

// Partagé entre tous les tests via beforeAll → beforeEach.
// Cookies extraits une fois et réinjectés dans chaque test's context.
let sharedCookies: Cookie[] = [];

test.describe.serial('@smoke Full user journey', () => {
  test.beforeAll(async ({ browser }) => {
    const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

    // Setup context unique pour login one-shot
    const setupContext = await browser.newContext();
    const response = await setupContext.request.post(`${apiUrl}/api/auth/login`, {
      data: {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      },
    });

    if (!response.ok()) {
      await setupContext.close();
      throw new Error(
        `Smoke beforeAll: Login API failed HTTP ${response.status()} for ${TEST_USERS.admin.email}`,
      );
    }

    // S7.5 PR5h/8 — utiliser context.cookies() direct (pas parsing Set-Cookie
    // manuel). Les cookies retournés par Playwright sont en format authentique
    // (domain/path/expires correctement résolus depuis Set-Cookie). Évite les
    // bugs de parsing manuel (sameSite mal détecté, expires=-1 forcé, etc.).
    sharedCookies = await setupContext.cookies();
    await setupContext.close();

    if (sharedCookies.length === 0 || !sharedCookies.some((c) => c.name === 'accessToken')) {
      throw new Error(
        `Smoke beforeAll: Login OK mais pas d'accessToken cookie extrait. Cookies: ${JSON.stringify(sharedCookies)}`,
      );
    }
  });

  // Réinjecte les cookies sur chaque test's context AVANT toute action.
  test.beforeEach(async ({ context }) => {
    await context.addCookies(sharedCookies);
  });

  test('1. Login admin (cookies preset) redirige vers /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('2. Dashboard accessible avec sidebar nav', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible({ timeout: 10000 });
  });

  test('3. Section Sites accessible', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/sites/);
    await expect(page.locator('[data-testid="nav-sites"]')).toBeVisible({ timeout: 10000 });
  });

  test('4. Section Équipements accessible', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/assets/);
    await expect(page.locator('[data-testid="nav-assets"]')).toBeVisible({ timeout: 10000 });
  });

  test('5. Section Baies accessible', async ({ page }) => {
    await page.goto('/dashboard/racks');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/racks/);
    await expect(page.locator('[data-testid="nav-racks"]')).toBeVisible({ timeout: 10000 });
  });

  test('6. Section Tâches accessible', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/tasks/);
    await expect(page.locator('[data-testid="nav-tasks"]')).toBeVisible({ timeout: 10000 });
  });

  test('7. Section Coûts accessible', async ({ page }) => {
    await page.goto('/dashboard/costs');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/costs/);
    await expect(page.locator('[data-testid="nav-costs"]')).toBeVisible({ timeout: 10000 });
  });

  test('8. Section Surveillance (monitoring) accessible', async ({ page }) => {
    await page.goto('/dashboard/monitoring');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/monitoring/);
    await expect(page.locator('[data-testid="nav-monitoring"]')).toBeVisible({ timeout: 10000 });
  });

  test('9. Section Notifications accessible', async ({ page }) => {
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/notifications/);
    // Post-v1.9.0 : Notifications a maintenant son entrée sidebar
    // (testid nav-notifications). Cf SELECTORS_STRATEGY.md zone α #2.
    await expect(page.locator('[data-testid="nav-notifications"]')).toBeVisible({ timeout: 10000 });
  });

  test('10. API /api/auth/session retourne user authentifié', async ({ page, request }) => {
    // Cookies déjà set via beforeEach. Pas besoin de loginAsAdmin.
    await page.goto('/dashboard');

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
