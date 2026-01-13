import { test, expect } from '../../fixtures/auth.fixture';
import { NavigationHelper } from '../../helpers/navigation';
import { TEST_DATA, generateUniqueData } from '../../helpers/test-data';

/**
 * Tests E2E - Sites - CRUD
 *
 * Scénarios testés:
 * - Liste des sites
 * - Création d'un site
 * - Modification d'un site
 * - Suppression d'un site
 * - Recherche de sites
 * - Affichage carte
 */

test.describe('Sites - CRUD', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    nav = new NavigationHelper(page);
    await nav.goToSites();
  });

  test('devrait afficher la liste des sites', async ({ page }) => {
    // Vérifier éléments de la page
    await expect(page.locator('h1, h2')).toContainText(/Sites|Chantiers/i);

    // Bouton "Nouveau"
    await expect(page.locator('button:has-text("Nouveau"), a:has-text("Nouveau")')).toBeVisible();

    // Table ou grille de sites (au moins l'élément container)
    const sitesList = page.locator('[data-testid="sites-list"], table, .grid');
    await expect(sitesList).toBeVisible();
  });

  test('devrait créer un nouveau site', async ({ page }) => {
    const siteData = generateUniqueData(TEST_DATA.sites.paris);

    // Cliquer sur "Nouveau"
    await nav.clickNewButton();

    // Attendre formulaire
    await page.waitForSelector('form');

    // Remplir le formulaire
    await page.fill('input[name="name"]', siteData.name);
    await page.fill('input[name="address"]', siteData.address);
    await page.fill('input[name="latitude"]', siteData.latitude.toString());
    await page.fill('input[name="longitude"]', siteData.longitude.toString());

    // Sélectionner status si présent
    const statusSelect = page.locator('select[name="status"], [name="status"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption(siteData.status);
    }

    // Soumettre
    await page.click('button[type="submit"]');

    // Attendre toast de succès
    await nav.waitForToast();

    // Vérifier redirection ou présence dans la liste
    const createdSite = page.locator(`text=${siteData.name}`);
    await expect(createdSite).toBeVisible({ timeout: 10000 });
  });

  test('devrait modifier un site existant', async ({ page }) => {
    // Supposer qu'il existe au moins un site
    // Cliquer sur le premier site
    const firstSite = page.locator('[data-testid="site-item"], table tbody tr, .site-card').first();
    await firstSite.click();

    // Attendre page détail
    await page.waitForLoadState('networkidle');

    // Cliquer sur "Modifier"
    await page.click('button:has-text("Modifier"), a:has-text("Modifier")');

    // Attendre formulaire
    await page.waitForSelector('form');

    // Modifier le nom
    const newName = `Site Modifié E2E ${Date.now()}`;
    await page.fill('input[name="name"]', newName);

    // Soumettre
    await page.click('button[type="submit"]');

    // Attendre toast
    await nav.waitForToast();

    // Vérifier modification
    await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 10000 });
  });

  test('devrait rechercher un site', async ({ page }) => {
    // Créer un site avec nom unique
    const uniqueSite = generateUniqueData(TEST_DATA.sites.lyon);

    // Créer le site d'abord
    await nav.clickNewButton();
    await page.waitForSelector('form');
    await page.fill('input[name="name"]', uniqueSite.name);
    await page.fill('input[name="address"]', uniqueSite.address);
    await page.fill('input[name="latitude"]', uniqueSite.latitude.toString());
    await page.fill('input[name="longitude"]', uniqueSite.longitude.toString());
    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Retourner à la liste
    await nav.goToSites();

    // Rechercher le site créé
    await nav.search(uniqueSite.name);

    // Vérifier résultat
    await expect(page.locator(`text=${uniqueSite.name}`)).toBeVisible({ timeout: 5000 });
  });

  test('devrait afficher la carte des sites', async ({ page }) => {
    // Vérifier présence du bouton/onglet carte
    const mapButton = page.locator('button:has-text("Carte"), a:has-text("Carte"), [role="tab"]:has-text("Carte")');

    if (await mapButton.isVisible()) {
      await mapButton.click();

      // Attendre chargement carte
      await page.waitForSelector('.leaflet-container, #map, [data-testid="map"]', { timeout: 10000 });

      // Vérifier présence markers
      const markers = page.locator('.leaflet-marker-icon, .marker');
      await expect(markers.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('devrait valider les champs requis lors de création', async ({ page }) => {
    await nav.clickNewButton();
    await page.waitForSelector('form');

    // Soumettre formulaire vide
    await page.click('button[type="submit"]');

    // Vérifier messages d'erreur ou validation HTML5
    const nameInput = page.locator('input[name="name"]');
    const addressInput = page.locator('input[name="address"]');

    const nameInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    const addressInvalid = await addressInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

    expect(nameInvalid || addressInvalid).toBeTruthy();
  });

  test('devrait supprimer un site (ADMIN uniquement)', async ({ page }) => {
    // Créer un site à supprimer
    const siteToDelete = generateUniqueData(TEST_DATA.sites.paris);

    await nav.clickNewButton();
    await page.waitForSelector('form');
    await page.fill('input[name="name"]', siteToDelete.name);
    await page.fill('input[name="address"]', siteToDelete.address);
    await page.fill('input[name="latitude"]', siteToDelete.latitude.toString());
    await page.fill('input[name="longitude"]', siteToDelete.longitude.toString());
    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Retourner à la liste
    await nav.goToSites();

    // Trouver le site et cliquer dessus
    await page.click(`text=${siteToDelete.name}`);
    await page.waitForLoadState('networkidle');

    // Cliquer sur supprimer
    const deleteButton = page.locator('button:has-text("Supprimer"), button[aria-label="Supprimer"]');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirmer si modal
      const confirmButton = page.locator('button:has-text("Confirmer"), button:has-text("Oui"), button:has-text("Supprimer")').last();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Attendre suppression
      await nav.waitForToast();

      // Vérifier disparition
      await expect(page.locator(`text=${siteToDelete.name}`)).not.toBeVisible({ timeout: 10000 });
    }
  });
});
