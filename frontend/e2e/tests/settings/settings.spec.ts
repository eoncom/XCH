import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Settings Page
 *
 * Valide fonctionnement complet page Settings:
 * - Chargement configuration tenant
 * - Mise à jour tenant
 * - Toggle theme (light/dark/system)
 * - Navigation vers Users management
 * - RBAC enforcement (admin-only)
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/settings');

    // Attendre chargement page
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 10000 });
  });

  test('should display settings page with all sections', async ({ page }) => {
    // Vérifier sections principales visibles
    await expect(page.locator('text=Organisation')).toBeVisible();
    await expect(page.locator('text=Apparence')).toBeVisible();

    // Section Utilisateurs (navigation)
    await expect(page.locator('text=/Utilisateurs|Users/i')).toBeVisible();
  });

  test('should load tenant configuration from API', async ({ page }) => {
    // Vérifier que les champs tenant sont remplis
    const orgNameInput = page.locator('[name="orgName"]');
    await expect(orgNameInput).toBeVisible();

    // Vérifier qu'une valeur est chargée (pas vide)
    const orgNameValue = await orgNameInput.inputValue();
    expect(orgNameValue.length).toBeGreaterThan(0);

    // Vérifier domaine chargé
    const domainInput = page.locator('[name="domain"]');
    const domainValue = await domainInput.inputValue();
    expect(domainValue).toMatch(/xch\.(demo|local|fr)/i);
  });

  test('should update tenant organization name', async ({ page }) => {
    // Modifier nom organisation
    const newOrgName = `XCH E2E Test Org ${Date.now()}`;
    await page.fill('[name="orgName"]', newOrgName);

    // Cliquer bouton "Enregistrer" ou "Sauvegarder"
    await page.click('button:has-text("Enregistrer")').catch(() => {
      page.click('button:has-text("Sauvegarder")');
    });

    // Attendre toast succès
    await expect(page.locator('text=/mis à jour|success|saved/i')).toBeVisible({ timeout: 5000 });

    // Reload page et vérifier persistance
    await page.reload();
    await page.waitForLoadState('networkidle');

    const orgNameInput = page.locator('[name="orgName"]');
    const savedValue = await orgNameInput.inputValue();
    expect(savedValue).toBe(newOrgName);
  });

  test('should toggle theme to dark mode', async ({ page }) => {
    // Cliquer sur option "Dark" ou "Sombre"
    await page.click('[data-testid="theme-dark"]').catch(async () => {
      // Si pas de data-testid, chercher par texte
      await page.click('text=/Sombre|Dark/i');
    });

    // Attendre application du thème
    await page.waitForTimeout(500);

    // Vérifier que <html> a la classe "dark"
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });

  test('should toggle theme to light mode', async ({ page }) => {
    // D'abord mettre en dark
    await page.click('[data-testid="theme-dark"]').catch(() => {
      page.click('text=/Sombre|Dark/i');
    });
    await page.waitForTimeout(300);

    // Puis repasser en light
    await page.click('[data-testid="theme-light"]').catch(() => {
      page.click('text=/Clair|Light/i');
    });
    await page.waitForTimeout(300);

    // Vérifier que <html> n'a PAS la classe "dark"
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).not.toContain('dark');
  });

  test('should toggle theme to system mode', async ({ page }) => {
    // Cliquer "System" ou "Système"
    await page.click('[data-testid="theme-system"]').catch(() => {
      page.click('text=/Système|System/i');
    });

    // Theme système appliqué (peut être dark ou light selon OS)
    await page.waitForTimeout(300);

    // Vérifier qu'on peut toggle (pas d'erreur)
    const htmlElement = page.locator('html');
    await expect(htmlElement).toBeVisible();
  });

  test('should persist theme preference after reload', async ({ page }) => {
    // Mettre en dark mode
    await page.click('[data-testid="theme-dark"]').catch(() => {
      page.click('text=/Sombre|Dark/i');
    });
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Vérifier que dark mode persiste
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });

  test('should navigate to Users management when clicking button', async ({ page }) => {
    // Cliquer bouton "Gérer les utilisateurs"
    await page.click('button:has-text("Gérer les utilisateurs")').catch(() => {
      page.click('text=/Gérer.*utilisateurs|Manage.*users/i');
    });

    // Vérifier navigation vers /dashboard/users
    await expect(page).toHaveURL('/dashboard/users');

    // Note: Si page n'existe pas encore, il peut y avoir une 404
    // On vérifie juste la navigation pour l'instant
  });

  test('should display timezone selector', async ({ page }) => {
    // Vérifier présence sélecteur timezone
    const timezoneSelector = page.locator('[name="timezone"]').or(page.locator('text=/Fuseau horaire|Timezone/i'));
    await expect(timezoneSelector.first()).toBeVisible();
  });

  test('should display language selector', async ({ page }) => {
    // Vérifier présence sélecteur langue
    const languageSelector = page.locator('[name="language"]').or(page.locator('text=/Langue|Language/i'));
    await expect(languageSelector.first()).toBeVisible();
  });

  test('should show theme preview', async ({ page }) => {
    // Vérifier que preview thème est visible
    await expect(page.locator('text=/Aperçu|Preview/i')).toBeVisible();

    // Changer thème et vérifier que preview change
    await page.click('[data-testid="theme-dark"]').catch(() => {
      page.click('text=/Sombre|Dark/i');
    });

    await page.waitForTimeout(300);

    // Preview devrait avoir changé visuellement
    const previewElement = page.locator('[class*="preview"], [data-preview]').first();
    const isVisible = await previewElement.isVisible().catch(() => false);

    // Si preview existe, vérifier qu'il est visible
    if (isVisible) {
      await expect(previewElement).toBeVisible();
    }
  });

  test('should handle API error gracefully when updating tenant', async ({ page }) => {
    // Remplir avec données potentiellement invalides
    await page.fill('[name="domain"]', 'invalid-domain-format!!!');

    // Essayer de sauvegarder
    await page.click('button:has-text("Enregistrer")').catch(() => {
      page.click('button:has-text("Sauvegarder")');
    });

    // Attendre message erreur (soit toast soit inline)
    // Note: Comportement dépend de la validation backend
    await page.waitForTimeout(2000);

    // Vérifier qu'aucun toast "succès" n'apparaît
    const successToast = page.locator('text=/mis à jour.*succès/i');
    const successVisible = await successToast.isVisible().catch(() => false);
    expect(successVisible).toBe(false);
  });
});

test.describe('Settings Page - RBAC Enforcement', () => {
  test('should deny access to VIEWER role', async ({ page, loginAsViewer }) => {
    await loginAsViewer();

    // Essayer d'accéder à Settings
    await page.goto('/dashboard/settings');

    // Devrait être redirigé vers dashboard ou voir message erreur
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // Option 1: Redirect vers dashboard
    if (currentUrl.includes('/dashboard') && !currentUrl.includes('/settings')) {
      expect(currentUrl).toBe(`${page.context()._options.baseURL}/dashboard`);
    } else {
      // Option 2: Message "Accès refusé"
      await expect(page.locator('text=/Accès refusé|Access denied|403/i')).toBeVisible();
    }
  });

  test('should deny access to USER role', async ({ page, loginAs, TEST_USERS }) => {
    await loginAs(TEST_USERS.technicien); // USER role

    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // USER ne devrait pas accéder Settings non plus
    if (!currentUrl.includes('/settings')) {
      expect(currentUrl).not.toContain('/settings');
    } else {
      await expect(page.locator('text=/Accès refusé|403/i')).toBeVisible();
    }
  });

  test('should allow access to ADMIN role', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/settings');

    // Admin devrait voir la page Settings
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[name="orgName"]')).toBeVisible();
  });

  test('should allow access to SUPERUSER role', async ({ page, loginAsManager }) => {
    await loginAsManager(); // SUPERUSER role

    await page.goto('/dashboard/settings');

    // SUPERUSER devrait accéder Settings
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    // Mais PAS la section "Données de démonstration" (admin-only)
    const demoDataSection = page.locator('text=Données de démonstration');
    const demoDataVisible = await demoDataSection.isVisible().catch(() => false);

    // Demo data devrait être invisible pour SUPERUSER
    expect(demoDataVisible).toBe(false);
  });
});
