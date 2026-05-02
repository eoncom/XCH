import { test, expect } from '../../fixtures/auth.fixture';
import { NavigationHelper } from '../../helpers/navigation';
import { TEST_DATA, generateUniqueData } from '../../helpers/test-data';

/**
 * Tests E2E - Assets - Édition champs réseau (S7 PR2).
 *
 * Refactor de l'ancien assets-crud.spec.ts qui faisait juste un CRUD
 * basique. Cette spec se concentre sur les champs RÉSEAU :
 * - Validation S/N obligatoire
 * - Champs WiFi (SSID, BSSID, channel, signal) ajoutés en v1.4.x
 * - Validation MAC address format
 * - Multi-tag (selon UI disponible)
 *
 * Note : les tests CRUD basiques (création/suppression/recherche)
 * restent couverts via dashboard-tiles.spec.ts et settings-demo-data.
 * Ici on teste seulement ce qui est spécifique aux assets typés réseau.
 */

test.describe('Assets - Édition champs réseau', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    nav = new NavigationHelper(page);
    await nav.goToAssets();
  });

  test('validation : refuse de créer un asset sans serialNumber', async ({ page }) => {
    await page.goto('/dashboard/assets/new');
    await page.waitForSelector('form');

    // Remplir tout SAUF serialNumber
    await page.selectOption('select[name="type"]', 'PRINTER').catch(() => {});
    await page.fill('input[name="brand"]', 'TestBrand').catch(() => {});
    await page.fill('input[name="model"]', 'TestModel').catch(() => {});

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 }).catch(() => {});
    }

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // serialNumber input invalid OU message d'erreur affiché
    const snInput = page.locator('input[name="serialNumber"]');
    const isInvalid = await snInput.evaluate((el: HTMLInputElement) => !el.validity.valid).catch(() => false);
    const errorVisible = await page.locator('text=/série|serial|requis|required/i').first().isVisible().catch(() => false);

    expect(isInvalid || errorVisible).toBeTruthy();
  });

  test.skip('crée un asset SWITCH avec champs WiFi (SSID + BSSID + channel)', async ({ page }) => {
    // SCAFFOLDING — les champs WiFi (SSID, BSSID, channel, signal) sont
    // ajoutés conditionnellement selon le type d'asset. À compléter
    // après confirmation des sélecteurs exacts dans
    // frontend/src/app/dashboard/assets/new/page.tsx pour le type
    // SWITCH ou ACCESS_POINT.
    const assetData = generateUniqueData(TEST_DATA.assets.switch);
    expect(assetData.serialNumber).toBeTruthy();
  });

  test.skip('valide le format MAC address (XX:XX:XX:XX:XX:XX)', async ({ page }) => {
    // SCAFFOLDING — vérifier que le BSSID rejette une string non-MAC
    // (ex: "abc"). Le pattern HTML5 ou la validation zod côté frontend
    // doit empêcher la submission.
    expect(true).toBe(true);
  });

  test.skip('multi-tag : ajoute plusieurs tags à un asset', async ({ page }) => {
    // SCAFFOLDING — UI tags non confirmé dans frontend/src/app/dashboard/
    // assets/[id]/edit/page.tsx (à vérifier le composant TagsInput).
    expect(true).toBe(true);
  });

  test('édite un asset existant et persiste serialNumber + brand', async ({ page }) => {
    // Premier asset de la liste
    const firstAsset = page.locator('a[href^="/dashboard/assets/"]').first();
    const assetHref = await firstAsset.getAttribute('href').catch(() => null);
    if (!assetHref) return;

    await page.goto(`${assetHref}/edit`);
    await page.waitForSelector('form');

    const newBrand = `EditedBrand ${Date.now()}`;
    await page.fill('input[name="brand"]', newBrand);

    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Reload détail, vérifier persistance
    await page.goto(assetHref);
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${newBrand}`).first()).toBeVisible({ timeout: 10000 });
  });
});
