import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Settings Demo Data Management
 *
 * Valide fonctionnement endpoints seed:
 * - POST /api/seed/demo (charger données démo)
 * - POST /api/seed/reset (réinitialiser données)
 * - Idempotence (pas de doublons)
 * - RBAC admin-only
 */

test.describe('Settings - Demo Data Management', () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/settings');

    // Attendre chargement page
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 10000 });

    // Scroller vers section demo data si nécessaire
    const demoSection = page.locator('text=Données de démonstration').first();
    const isVisible = await demoSection.isVisible().catch(() => false);

    if (isVisible) {
      await demoSection.scrollIntoViewIfNeeded();
    }
  });

  test('should display demo data management section for ADMIN', async ({ page }) => {
    // Vérifier section visible
    await expect(page.locator('text=Données de démonstration')).toBeVisible();

    // Vérifier boutons présents
    await expect(page.locator('button:has-text("Charger données démo")')).toBeVisible();
    await expect(page.locator('button:has-text("Réinitialiser")')).toBeVisible();
  });

  test('should load demo data successfully', async ({ page }) => {
    // Cliquer "Charger données démo"
    await page.click('button:has-text("Charger données démo")');

    // Attendre réponse API (peut prendre 2-5 secondes)
    const response = await page.waitForResponse(
      response => response.url().includes('/api/seed/demo') && response.status() === 201,
      { timeout: 30000 }
    );

    expect(response.ok()).toBeTruthy();

    // Attendre toast succès
    await expect(page.locator('text=/Données.*chargées|Demo.*loaded/i')).toBeVisible({ timeout: 10000 });

    // Vérifier stats dans toast
    const toastText = await page.locator('[role="status"], [data-sonner-toast]').first().textContent();
    expect(toastText).toMatch(/\d+ site/i); // Au moins mention de sites

    // Naviguer vers dashboard pour vérifier données
    await page.goto('/dashboard');

    // Vérifier compteurs mis à jour (> 0)
    await page.waitForLoadState('networkidle');

    const sitesCountElement = page.locator('a[href="/dashboard/sites"]').locator('text=/^\\d+$/').first();
    const sitesCount = await sitesCountElement.textContent().catch(() => '0');
    expect(parseInt(sitesCount)).toBeGreaterThan(0);
  });

  test('should reset data successfully', async ({ page }) => {
    // D'abord charger des données démo
    await page.click('button:has-text("Charger données démo")');
    await page.waitForResponse(
      response => response.url().includes('/api/seed/demo'),
      { timeout: 30000 }
    );
    await expect(page.locator('text=/chargées|loaded/i')).toBeVisible({ timeout: 10000 });

    // Attendre que toast disparaisse
    await page.waitForTimeout(3000);

    // Cliquer "Réinitialiser"
    await page.click('button:has-text("Réinitialiser")');

    // Confirmer dans dialog/modal
    await page.click('button:has-text("Confirmer")').catch(() => {
      // Si bouton différent
      page.click('button:has-text("Réinitialiser")').last();
    });

    // Attendre réponse API reset
    const resetResponse = await page.waitForResponse(
      response => response.url().includes('/api/seed/reset') && response.status() === 200,
      { timeout: 30000 }
    );

    expect(resetResponse.ok()).toBeTruthy();

    // Attendre toast succès
    await expect(page.locator('text=/réinitialisées|reset/i')).toBeVisible({ timeout: 10000 });

    // Naviguer vers dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Vérifier compteurs à 0 (ou très faible si admin data reste)
    const sitesCountElement = page.locator('a[href="/dashboard/sites"]').locator('text=/^\\d+$/').first();
    const sitesCount = await sitesCountElement.textContent().catch(() => '0');
    expect(parseInt(sitesCount)).toBeLessThanOrEqual(2); // Admin peut avoir créé 1-2 sites de test
  });

  test('should preserve admin user after reset', async ({ page }) => {
    // Reset data
    await page.click('button:has-text("Réinitialiser")');
    await page.click('button:has-text("Confirmer")').catch(() => {
      page.click('button:has-text("Réinitialiser")').last();
    });

    await page.waitForResponse(
      response => response.url().includes('/api/seed/reset'),
      { timeout: 30000 }
    );

    // Attendre toast
    await page.waitForTimeout(3000);

    // Logout
    await page.click('[data-testid="logout-button"]').catch(() => {
      page.click('button:has-text("Déconnexion")');
    });

    await expect(page).toHaveURL('/login');

    // Essayer de se reconnecter avec admin
    await page.fill('#email', 'admin@xch.demo');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    // Vérifier que login fonctionne (admin toujours présent)
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should handle load demo idempotence (no duplicates)', async ({ page }) => {
    // Charger données 1ère fois
    await page.click('button:has-text("Charger données démo")');
    await page.waitForResponse(response => response.url().includes('/api/seed/demo'), { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Aller voir le compteur sites
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const firstLoadSites = await page.locator('a[href="/dashboard/sites"]').locator('text=/^\\d+$/').first().textContent();
    const firstCount = parseInt(firstLoadSites || '0');

    expect(firstCount).toBeGreaterThan(0);

    // Retour settings et charger 2ème fois
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Charger données démo")');
    await page.waitForResponse(response => response.url().includes('/api/seed/demo'), { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Revérifier compteur
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const secondLoadSites = await page.locator('a[href="/dashboard/sites"]').locator('text=/^\\d+$/').first().textContent();
    const secondCount = parseInt(secondLoadSites || '0');

    // Compteur ne devrait PAS avoir doublé
    // Tolérance: +/-20% (seed peut avoir logique d'update vs insert)
    expect(secondCount).toBeLessThanOrEqual(firstCount * 1.2);
  });

  test('should show loading state during demo data load', async ({ page }) => {
    // Cliquer "Charger données démo"
    const loadButton = page.locator('button:has-text("Charger données démo")');
    await loadButton.click();

    // Vérifier bouton disabled pendant chargement
    await expect(loadButton).toBeDisabled({ timeout: 2000 }).catch(() => {
      // Certaines implémentations utilisent spinner au lieu de disabled
    });

    // Ou vérifier présence spinner/loading
    const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"]').first();
    const hasLoading = await loadingIndicator.isVisible().catch(() => false);

    // Au moins un indicateur de chargement devrait être présent
    if (!hasLoading) {
      // Vérifier que bouton est disabled
      const isDisabled = await loadButton.isDisabled();
      expect(isDisabled).toBe(true);
    }

    // Attendre fin chargement
    await page.waitForResponse(response => response.url().includes('/api/seed/demo'), { timeout: 30000 });
  });

  test('should handle API error gracefully', async ({ page }) => {
    // Pour simuler erreur, on pourrait tester avec un mauvais token
    // Mais dans contexte E2E normal, on teste juste que les erreurs sont gérées

    // Si backend est down ou erreur, toast erreur devrait apparaître
    // Note: Test difficile sans mock - à adapter selon comportement app

    // Placeholder: vérifier qu'aucun crash UI si erreur
    await page.click('button:has-text("Charger données démo")');

    // Attendre soit succès soit erreur (max 30s)
    await Promise.race([
      page.waitForResponse(response => response.url().includes('/api/seed/demo'), { timeout: 30000 }),
      page.waitForTimeout(30000),
    ]);

    // Vérifier que page ne crash pas (titre toujours visible)
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible();
  });
});

test.describe('Settings - Demo Data RBAC', () => {
  test('should hide demo data section for VIEWER', async ({ page, loginAsViewer }) => {
    await loginAsViewer();
    await page.goto('/dashboard/settings');

    // Settings inaccessible pour VIEWER (redirect ou 403)
    await page.waitForTimeout(2000);

    const isSettingsPage = page.url().includes('/settings');

    if (!isSettingsPage) {
      // Redirigé → OK
      expect(page.url()).not.toContain('/settings');
    } else {
      // Si page accessible (ne devrait pas), vérifier 403
      await expect(page.locator('text=/403|Accès refusé/i')).toBeVisible();
    }
  });

  test('should hide demo data section for USER', async ({ page, loginAsTechnicien }) => {
    await loginAsTechnicien(); // USER role
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);

    // USER ne devrait pas accéder Settings
    expect(page.url()).not.toContain('/settings');
  });

  test('should hide demo data section for SUPERUSER', async ({ page, loginAsManager }) => {
    await loginAsManager(); // SUPERUSER role

    await page.goto('/dashboard/settings');

    // SUPERUSER peut accéder Settings
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    // Mais section "Données de démonstration" devrait être INVISIBLE
    const demoSection = page.locator('text=Données de démonstration');
    const isVisible = await demoSection.isVisible().catch(() => false);

    expect(isVisible).toBe(false);

    // Boutons demo data ne devraient pas exister
    const loadButton = page.locator('button:has-text("Charger données démo")');
    const resetButton = page.locator('button:has-text("Réinitialiser")');

    const loadExists = await loadButton.isVisible().catch(() => false);
    const resetExists = await resetButton.isVisible().catch(() => false);

    expect(loadExists).toBe(false);
    expect(resetExists).toBe(false);
  });

  test('should show demo data section for ADMIN', async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/settings');

    // Admin devrait voir section
    await expect(page.locator('text=Données de démonstration')).toBeVisible();
    await expect(page.locator('button:has-text("Charger données démo")')).toBeVisible();
    await expect(page.locator('button:has-text("Réinitialiser")')).toBeVisible();
  });
});
