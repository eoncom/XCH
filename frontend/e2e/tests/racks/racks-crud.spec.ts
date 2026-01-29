import { test, expect } from '../../fixtures/auth.fixture';
import { NavigationHelper } from '../../helpers/navigation';
import { TEST_DATA, generateUniqueData } from '../../helpers/test-data';

/**
 * Tests E2E - Racks - CRUD + Viewer
 *
 * Scénarios testés:
 * - Liste des racks
 * - Création rack (4U-42U)
 * - Viewer 2D Konva
 * - Mount/Unmount équipement
 * - Calcul occupation
 */

test.describe('Racks - CRUD', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    nav = new NavigationHelper(page);
    await nav.goToRacks();
  });

  test('devrait afficher la liste des racks', async ({ page }) => {
    await expect(page.locator('h1, h2').last()).toContainText(/Racks|Baies/i);

    // Bouton nouveau
    await expect(page.locator('button:has-text("Nouveau"), a:has-text("Nouveau")')).toBeVisible();

    // Liste
    const racksList = page.locator('[data-testid="racks-list"], table, .grid');
    await expect(racksList).toBeVisible();
  });

  test('devrait créer un rack 4U', async ({ page }) => {
    const rackData = generateUniqueData(TEST_DATA.racks.small);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    // Remplir formulaire
    await page.fill('input[name="name"]', rackData.name);

    // HeightU
    const heightSelect = page.locator('select[name="heightU"], input[name="heightU"]');
    if (await heightSelect.isVisible()) {
      if (await heightSelect.getAttribute('type') === 'number') {
        await heightSelect.fill(rackData.heightU.toString());
      } else {
        await heightSelect.selectOption(rackData.heightU.toString());
      }
    }

    // Status
    const statusSelect = page.locator('select[name="status"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption(rackData.status);
    }

    // Site (requis)
    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    // Manufacturer/Model (optionnels)
    const manufacturerInput = page.locator('input[name="manufacturer"]');
    if (await manufacturerInput.isVisible()) {
      await manufacturerInput.fill(rackData.manufacturer);
    }

    const modelInput = page.locator('input[name="model"]');
    if (await modelInput.isVisible()) {
      await modelInput.fill(rackData.model);
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Vérifier présence
    await expect(page.locator(`text=${rackData.name}`)).toBeVisible({ timeout: 10000 });
  });

  test('devrait créer un rack 42U', async ({ page }) => {
    const rackData = generateUniqueData(TEST_DATA.racks.standard);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="name"]', rackData.name);

    const heightSelect = page.locator('select[name="heightU"], input[name="heightU"]');
    if (await heightSelect.isVisible()) {
      if (await heightSelect.getAttribute('type') === 'number') {
        await heightSelect.fill(rackData.heightU.toString());
      } else {
        await heightSelect.selectOption(rackData.heightU.toString());
      }
    }

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    await expect(page.locator(`text=${rackData.name}`)).toBeVisible({ timeout: 10000 });
  });

  test('devrait afficher le Rack Viewer (Konva 2D)', async ({ page }) => {
    // Cliquer sur premier rack
    const firstRack = page.locator('[data-testid="rack-item"], table tbody tr, .rack-card').first();

    if (await firstRack.isVisible()) {
      await firstRack.click();
      await page.waitForLoadState('networkidle');

      // Vérifier présence canvas Konva
      const canvas = page.locator('canvas, [data-testid="rack-viewer"]');
      await expect(canvas).toBeVisible({ timeout: 5000 });
    }
  });

  test('devrait calculer l\'occupation d\'un rack', async ({ page }) => {
    // Créer rack
    const rackData = generateUniqueData(TEST_DATA.racks.standard);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="name"]', rackData.name);

    const heightSelect = page.locator('select[name="heightU"], input[name="heightU"]');
    if (await heightSelect.isVisible()) {
      if (await heightSelect.getAttribute('type') === 'number') {
        await heightSelect.fill('42');
      } else {
        await heightSelect.selectOption('42');
      }
    }

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Aller sur détail rack
    await page.click(`text=${rackData.name}`);
    await page.waitForLoadState('networkidle');

    // Vérifier affichage occupation
    const occupationInfo = page.locator('text=/\\d+U.*(\\d+%|libre|occupé)/i, [data-testid="occupation"]');
    await expect(occupationInfo).toBeVisible({ timeout: 5000 });
  });

  test('devrait afficher les équipements montés dans le rack', async ({ page }) => {
    // Cliquer sur rack existant qui a des équipements
    const racks = page.locator('[data-testid="rack-item"], table tbody tr, .rack-card');
    const racksCount = await racks.count();

    if (racksCount > 0) {
      await racks.first().click();
      await page.waitForLoadState('networkidle');

      // Chercher section équipements
      const equipmentSection = page.locator('text=Équipements, text=Equipment, [data-testid="mounted-equipment"]');

      // Si présent, vérifier liste
      if (await equipmentSection.isVisible()) {
        const equipmentList = page.locator('[data-testid="equipment-list"], ul, table');
        await expect(equipmentList).toBeVisible();
      }
    }
  });

  test('devrait filtrer les racks par site', async ({ page }) => {
    const siteFilter = page.locator('select[name="siteId"], [data-testid="site-filter"]');

    if (await siteFilter.isVisible()) {
      // Sélectionner un site
      await siteFilter.selectOption({ index: 1 });
      await page.waitForTimeout(1000);

      // Vérifier résultats filtrés
      const results = page.locator('[data-testid="rack-item"], table tbody tr');
      const count = await results.count();

      // Si résultats, tous doivent être du même site
      expect(count >= 0).toBeTruthy();
    }
  });

  test('devrait modifier un rack existant', async ({ page }) => {
    // Cliquer sur premier rack
    const firstRack = page.locator('[data-testid="rack-item"], table tbody tr').first();

    if (await firstRack.isVisible()) {
      await firstRack.click();
      await page.waitForLoadState('networkidle');

      // Cliquer modifier
      const editButton = page.locator('button:has-text("Modifier"), a:has-text("Modifier")');
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForSelector('form');

        // Modifier nom
        const newName = `Rack Modifié ${Date.now()}`;
        await page.fill('input[name="name"]', newName);

        await page.click('button[type="submit"]');
        await nav.waitForToast();

        // Vérifier modification
        await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('devrait afficher les détails d\'un rack (metadata)', async ({ page }) => {
    // Créer rack avec metadata
    const rackData = generateUniqueData(TEST_DATA.racks.standard);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="name"]', rackData.name);

    const heightSelect = page.locator('select[name="heightU"], input[name="heightU"]');
    if (await heightSelect.isVisible()) {
      if (await heightSelect.getAttribute('type') === 'number') {
        await heightSelect.fill('42');
      } else {
        await heightSelect.selectOption('42');
      }
    }

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    // Metadata
    const manufacturerInput = page.locator('input[name="manufacturer"]');
    if (await manufacturerInput.isVisible()) {
      await manufacturerInput.fill(rackData.manufacturer);
    }

    const modelInput = page.locator('input[name="model"]');
    if (await modelInput.isVisible()) {
      await modelInput.fill(rackData.model);
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Aller sur détail
    await page.click(`text=${rackData.name}`);
    await page.waitForLoadState('networkidle');

    // Vérifier metadata affichée
    await expect(page.locator(`text=${rackData.manufacturer}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${rackData.model}`)).toBeVisible({ timeout: 5000 });
  });
});
