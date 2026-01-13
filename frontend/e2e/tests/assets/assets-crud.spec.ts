import { test, expect } from '../../fixtures/auth.fixture';
import { NavigationHelper } from '../../helpers/navigation';
import { TEST_DATA, generateUniqueData } from '../../helpers/test-data';

/**
 * Tests E2E - Assets - CRUD + QR Codes
 *
 * Scénarios testés:
 * - Liste des assets
 * - Création d'un asset
 * - Modification d'un asset
 * - Génération QR code
 * - Download QR code PNG
 * - Filtres par type/status
 */

test.describe('Assets - CRUD', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    nav = new NavigationHelper(page);
    await nav.goToAssets();
  });

  test('devrait afficher la liste des assets', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/Assets|Équipements/i);

    // Bouton nouveau
    await expect(page.locator('button:has-text("Nouveau"), a:has-text("Nouveau")')).toBeVisible();

    // Liste
    const assetsList = page.locator('[data-testid="assets-list"], table, .grid');
    await expect(assetsList).toBeVisible();
  });

  test('devrait créer un nouvel asset (imprimante)', async ({ page }) => {
    const assetData = generateUniqueData(TEST_DATA.assets.printer);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    // Remplir formulaire
    await page.selectOption('select[name="type"]', assetData.type);
    await page.fill('input[name="brand"]', assetData.brand);
    await page.fill('input[name="model"]', assetData.model);
    await page.fill('input[name="serialNumber"]', assetData.serialNumber);

    // Status
    const statusSelect = page.locator('select[name="status"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption(assetData.status);
    }

    // Sélectionner un site (requis)
    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      // Sélectionner le premier site disponible
      await siteSelect.selectOption({ index: 1 });
    }

    // Soumettre
    await page.click('button[type="submit"]');

    // Attendre succès
    await nav.waitForToast();

    // Vérifier présence dans la liste
    await expect(page.locator(`text=${assetData.serialNumber}`)).toBeVisible({ timeout: 10000 });
  });

  test('devrait créer un asset iPad', async ({ page }) => {
    const assetData = generateUniqueData(TEST_DATA.assets.ipad);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.selectOption('select[name="type"]', assetData.type);
    await page.fill('input[name="brand"]', assetData.brand);
    await page.fill('input[name="model"]', assetData.model);
    await page.fill('input[name="serialNumber"]', assetData.serialNumber);

    // Site
    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    await expect(page.locator(`text=${assetData.serialNumber}`)).toBeVisible({ timeout: 10000 });
  });

  test('devrait afficher le QR code d\'un asset', async ({ page }) => {
    // Créer un asset d'abord
    const assetData = generateUniqueData(TEST_DATA.assets.switch);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.selectOption('select[name="type"]', assetData.type);
    await page.fill('input[name="brand"]', assetData.brand);
    await page.fill('input[name="model"]', assetData.model);
    await page.fill('input[name="serialNumber"]', assetData.serialNumber);

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Cliquer sur l'asset créé
    await page.click(`text=${assetData.serialNumber}`);
    await page.waitForLoadState('networkidle');

    // Vérifier présence QR code
    const qrCode = page.locator('canvas, img[alt*="QR"], svg[data-testid="qr-code"]');
    await expect(qrCode).toBeVisible({ timeout: 5000 });
  });

  test('devrait permettre le download du QR code', async ({ page }) => {
    // Créer asset
    const assetData = generateUniqueData(TEST_DATA.assets.printer);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.selectOption('select[name="type"]', assetData.type);
    await page.fill('input[name="serialNumber"]', assetData.serialNumber);

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Aller sur détail asset
    await page.click(`text=${assetData.serialNumber}`);
    await page.waitForLoadState('networkidle');

    // Chercher bouton download QR
    const downloadButton = page.locator('button:has-text("Télécharger"), button:has-text("Download"), a[download*="qr"]');

    if (await downloadButton.isVisible()) {
      // Intercepter le download
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      const download = await downloadPromise;

      // Vérifier que le fichier est un PNG
      expect(download.suggestedFilename()).toMatch(/\.png$/i);
    }
  });

  test('devrait filtrer les assets par type', async ({ page }) => {
    // Vérifier présence filtre type
    const typeFilter = page.locator('select[name="type"], [data-testid="type-filter"]');

    if (await typeFilter.isVisible()) {
      // Sélectionner PRINTER
      await typeFilter.selectOption('PRINTER');

      // Attendre résultats
      await page.waitForTimeout(1000);

      // Vérifier que seuls les printers sont affichés
      const results = page.locator('[data-testid="asset-item"], table tbody tr');
      const count = await results.count();

      if (count > 0) {
        // Vérifier le premier résultat contient "PRINTER"
        await expect(results.first()).toContainText(/PRINTER|Imprimante/i);
      }
    }
  });

  test('devrait filtrer les assets par status', async ({ page }) => {
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('IN_SERVICE');
      await page.waitForTimeout(1000);

      const results = page.locator('[data-testid="asset-item"], table tbody tr');
      const count = await results.count();

      if (count > 0) {
        await expect(results.first()).toContainText(/IN_SERVICE|En service/i);
      }
    }
  });

  test('devrait rechercher un asset par serial number', async ({ page }) => {
    // Créer asset avec serial unique
    const assetData = generateUniqueData(TEST_DATA.assets.ipad);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.selectOption('select[name="type"]', assetData.type);
    await page.fill('input[name="serialNumber"]', assetData.serialNumber);

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Retourner liste
    await nav.goToAssets();

    // Rechercher
    await nav.search(assetData.serialNumber);

    // Vérifier résultat
    await expect(page.locator(`text=${assetData.serialNumber}`)).toBeVisible({ timeout: 5000 });
  });

  test('devrait modifier un asset existant', async ({ page }) => {
    // Cliquer sur premier asset
    const firstAsset = page.locator('[data-testid="asset-item"], table tbody tr').first();

    if (await firstAsset.isVisible()) {
      await firstAsset.click();
      await page.waitForLoadState('networkidle');

      // Cliquer modifier
      const editButton = page.locator('button:has-text("Modifier"), a:has-text("Modifier")');
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForSelector('form');

        // Modifier brand
        const newBrand = `Brand Modified ${Date.now()}`;
        await page.fill('input[name="brand"]', newBrand);

        await page.click('button[type="submit"]');
        await nav.waitForToast();

        // Vérifier modification
        await expect(page.locator(`text=${newBrand}`)).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
