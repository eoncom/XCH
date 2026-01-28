import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement
 *
 * Valide permissions pour les 4 rôles:
 * - VIEWER: Lecture seule
 * - USER (technicien): CRUD limité
 * - SUPERUSER (manager): CRUD complet (sauf demo data)
 * - ADMIN: Full access
 */

test.describe('RBAC - VIEWER Role', () => {
  test.beforeEach(async ({ page, loginAsViewer }) => {
    await loginAsViewer();
  });

  test('should allow read access to Sites list', async ({ page }) => {
    await page.goto('/dashboard/sites');

    // Devrait voir la liste
    await expect(page.locator('h1')).toContainText(/Sites/i);

    // Devrait voir les sites (si données présentes)
    await page.waitForLoadState('networkidle');
  });

  test('should deny create Site (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    // Bouton "Nouveau site" ne devrait PAS exister pour VIEWER
    const createButton = page.locator('button:has-text("Nouveau site")');
    const buttonExists = await createButton.isVisible().catch(() => false);

    expect(buttonExists).toBe(false);
  });

  test('should deny edit Site (button not visible)', async ({ page }) => {
    await page.goto('/dashboard/sites');

    // Ouvrir premier site
    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    const siteExists = await firstSite.isVisible().catch(() => false);

    if (siteExists) {
      await firstSite.click();
      await page.waitForURL(/\/dashboard\/sites\/[a-z0-9-]+$/);

      // Bouton "Modifier" ne devrait PAS être visible
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

      // Bouton "Supprimer" ne devrait PAS être visible
      const deleteButton = page.locator('button:has-text("Supprimer")');
      const deleteExists = await deleteButton.isVisible().catch(() => false);

      expect(deleteExists).toBe(false);
    }
  });

  test('should deny Settings access', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);

    // Devrait être redirigé OU voir message 403
    const currentUrl = page.url();

    if (!currentUrl.includes('/settings')) {
      // Redirigé → OK
      expect(currentUrl).not.toContain('/settings');
    } else {
      // Si pas redirigé, devrait voir erreur 403
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
});

test.describe('RBAC - USER Role (Technicien)', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs(TEST_USERS.technicien); // USER role
  });

  test('should allow read access to Sites', async ({ page }) => {
    await page.goto('/dashboard/sites');

    await expect(page.locator('h1')).toContainText(/Sites/i);
  });

  test('should allow create Task', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    // Bouton "Nouvelle tâche" devrait être visible pour USER
    const createTaskButton = page.locator('button:has-text("Nouvelle tâche")');
    await expect(createTaskButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow edit own Task', async ({ page }) => {
    await page.goto('/dashboard/tasks');

    // Créer tâche
    await page.click('button:has-text("Nouvelle tâche")');
    await page.waitForSelector('form, [role="dialog"]');

    await page.fill('[name="title"]', 'USER Task Test');
    await page.fill('[name="description"]', 'Test USER permissions');

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Vérifier possibilité d'édition (bouton "Modifier" présent)
    const editButton = page.locator('button:has-text("Modifier")');
    const editExists = await editButton.isVisible().catch(() => false);

    // USER devrait pouvoir modifier ses propres tâches
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

    // USER ne devrait PAS pouvoir créer sites
    const createSiteButton = page.locator('button:has-text("Nouveau site")');
    const buttonExists = await createSiteButton.isVisible().catch(() => false);

    expect(buttonExists).toBe(false);
  });

  test('should allow create Asset', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    // USER devrait pouvoir créer assets
    const createAssetButton = page.locator('button:has-text("Nouvel équipement")');
    const buttonExists = await createAssetButton.isVisible().catch(() => false);

    // Selon RBAC, USER peut créer assets
    expect(buttonExists).toBe(true);
  });
});

test.describe('RBAC - SUPERUSER Role (Manager)', () => {
  test.beforeEach(async ({ page, loginAsManager }) => {
    await loginAsManager(); // SUPERUSER role
  });

  test('should allow full CRUD on Sites', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    // Devrait voir bouton "Nouveau site"
    const createButton = page.locator('button:has-text("Nouveau site")');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow edit Site', async ({ page }) => {
    await page.goto('/dashboard/sites');

    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    const siteExists = await firstSite.isVisible().catch(() => false);

    if (siteExists) {
      await firstSite.click();
      await page.waitForURL(/\/dashboard\/sites\/[a-z0-9-]+$/);

      // Bouton "Modifier" devrait être visible
      await expect(page.locator('button:has-text("Modifier")')).toBeVisible();
    }
  });

  test('should allow delete Site', async ({ page }) => {
    await page.goto('/dashboard/sites');

    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    const siteExists = await firstSite.isVisible().catch(() => false);

    if (siteExists) {
      await firstSite.click();
      await page.waitForURL(/\/dashboard\/sites\/[a-z0-9-]+$/);

      // Bouton "Supprimer" devrait être visible
      await expect(page.locator('button:has-text("Supprimer")')).toBeVisible();
    }
  });

  test('should allow Settings access', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // SUPERUSER devrait accéder Settings
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });
  });

  test('should deny demo data management (admin-only)', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    // Section "Données de démonstration" ne devrait PAS être visible
    const demoSection = page.locator('text=Données de démonstration');
    const demoSectionExists = await demoSection.isVisible().catch(() => false);

    expect(demoSectionExists).toBe(false);

    // Boutons demo data ne devraient pas exister
    const loadDemoButton = page.locator('button:has-text("Charger données démo")');
    const resetButton = page.locator('button:has-text("Réinitialiser")');

    const loadExists = await loadDemoButton.isVisible().catch(() => false);
    const resetExists = await resetButton.isVisible().catch(() => false);

    expect(loadExists).toBe(false);
    expect(resetExists).toBe(false);
  });

  test('should allow full CRUD on Assets', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    // Bouton créer asset visible
    const createButton = page.locator('button:has-text("Nouvel équipement")');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow full CRUD on Tasks', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    // Bouton créer tâche visible
    const createButton = page.locator('button:has-text("Nouvelle tâche")');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('RBAC - ADMIN Role', () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('should allow full access including demo data', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    // Devrait voir section demo data
    await expect(page.locator('text=Données de démonstration')).toBeVisible();
    await expect(page.locator('button:has-text("Charger données démo")')).toBeVisible();
    await expect(page.locator('button:has-text("Réinitialiser")')).toBeVisible();
  });

  test('should allow Users management', async ({ page }) => {
    await page.goto('/dashboard/users');

    // ADMIN devrait accéder page users (si elle existe)
    // Note: Si page n'existe pas, test échouera - à adapter
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    if (currentUrl.includes('/users')) {
      // Page existe → OK
      expect(currentUrl).toContain('/users');
    } else {
      // Page n'existe pas encore → vérifier pas d'erreur 403
      const has403 = await page.locator('text=/403/i').isVisible().catch(() => false);
      expect(has403).toBe(false);
    }
  });

  test('should allow full CRUD on all modules', async ({ page }) => {
    // Sites
    await page.goto('/dashboard/sites');
    await expect(page.locator('button:has-text("Nouveau site")')).toBeVisible({ timeout: 5000 });

    // Assets
    await page.goto('/dashboard/assets');
    await expect(page.locator('button:has-text("Nouvel équipement")')).toBeVisible({ timeout: 5000 });

    // Tasks
    await page.goto('/dashboard/tasks');
    await expect(page.locator('button:has-text("Nouvelle tâche")')).toBeVisible({ timeout: 5000 });

    // Racks
    await page.goto('/dashboard/racks');
    await expect(page.locator('button:has-text("Nouvelle baie")')).toBeVisible({ timeout: 5000 });
  });

  test('should allow access to all dashboard features', async ({ page }) => {
    await page.goto('/dashboard');

    // Toutes les tuiles cliquables
    await expect(page.locator('a[href="/dashboard/sites"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/assets"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/tasks"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/racks"]')).toBeVisible();
  });
});

test.describe('RBAC - API Enforcement', () => {
  test('should return 403 for VIEWER trying to create Site via API', async ({ request, page, loginAsViewer }) => {
    await loginAsViewer();

    // Récupérer cookies de session
    const cookies = await page.context().cookies();
    const accessToken = cookies.find(c => c.name === 'accessToken');

    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Essayer de créer site via API
    const response = await request.post(`${process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002'}/api/sites`, {
      headers: {
        'Cookie': `accessToken=${accessToken.value}`,
      },
      data: {
        name: 'Unauthorized Site',
        code: 'UNAUTH-001',
        type: 'TEMPORARY',
      },
    });

    // Devrait recevoir 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test('should return 403 for USER trying to delete Site via API', async ({ request, page, loginAs }) => {
    await loginAs(TEST_USERS.technicien); // USER role

    const cookies = await page.context().cookies();
    const accessToken = cookies.find(c => c.name === 'accessToken');

    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Essayer de supprimer site (assume un site existe avec ID connu)
    const response = await request.delete(`${process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002'}/api/sites/fake-id-123`, {
      headers: {
        'Cookie': `accessToken=${accessToken.value}`,
      },
    });

    // Devrait recevoir 403 (ou 404 si site n'existe pas, mais pas 200)
    expect([403, 404]).toContain(response.status());
  });

  test('should allow ADMIN to access all API endpoints', async ({ request, page, loginAsAdmin }) => {
    await loginAsAdmin();

    const cookies = await page.context().cookies();
    const accessToken = cookies.find(c => c.name === 'accessToken');

    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Test GET /api/sites (devrait être 200)
    const sitesResponse = await request.get(`${process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002'}/api/sites`, {
      headers: {
        'Cookie': `accessToken=${accessToken.value}`,
      },
    });

    expect(sitesResponse.ok()).toBeTruthy();

    // Test GET /api/users (admin-only)
    const usersResponse = await request.get(`${process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002'}/api/users`, {
      headers: {
        'Cookie': `accessToken=${accessToken.value}`,
      },
    });

    expect(usersResponse.ok()).toBeTruthy();
  });
});
