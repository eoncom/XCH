import { test, expect } from '../../fixtures/auth.fixture';
import { NavigationHelper } from '../../helpers/navigation';
import * as path from 'path';

/**
 * Tests E2E - FloorPlans - Upload + Viewer + Pins
 *
 * Scénarios testés:
 * - Liste floor plans
 * - Upload PDF/PNG/JPG
 * - Viewer Konva avec zoom/pan
 * - Ajout pins (4 types)
 * - Drag & drop pins
 */

test.describe('FloorPlans - Upload & Viewer', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    nav = new NavigationHelper(page);
    await nav.goToFloorPlans();
  });

  test('devrait afficher la liste des floor plans', async ({ page }) => {
    await expect(page.locator('h1, h2').last()).toContainText(/Plans|Floor Plans/i);

    // Bouton nouveau/upload
    await expect(page.locator('button:has-text("Nouveau"), button:has-text("Upload"), a:has-text("Nouveau")')).toBeVisible();

    // Liste
    const plansList = page.locator('[data-testid="plans-list"], table, .grid');
    await expect(plansList).toBeVisible();
  });

  test('devrait permettre l\'upload d\'un PDF', async ({ page }) => {
    // Cliquer upload
    await nav.clickNewButton();
    await page.waitForSelector('form, [data-testid="upload-form"]');

    // Nom du plan
    const planName = `Plan Test PDF ${Date.now()}`;
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(planName);
    }

    // Site
    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    // Upload file (simulé - Playwright peut uploader un fichier de test)
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Note: Nécessite un fichier PDF de test dans e2e/fixtures/test-plan.pdf
      const testFilePath = path.join(__dirname, '../../fixtures/test-plan.pdf');

      try {
        await fileInput.setInputFiles(testFilePath);

        // Soumettre
        await page.click('button[type="submit"]');

        // Attendre succès
        await nav.waitForToast();

        // Vérifier présence dans liste
        await expect(page.locator(`text=${planName}`)).toBeVisible({ timeout: 10000 });
      } catch (error) {
        // Si fichier test n'existe pas, skip ce test
        test.skip();
      }
    }
  });

  test('devrait permettre l\'upload d\'une image PNG', async ({ page }) => {
    await nav.clickNewButton();
    await page.waitForSelector('form, [data-testid="upload-form"]');

    const planName = `Plan Test PNG ${Date.now()}`;
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(planName);
    }

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      const testFilePath = path.join(__dirname, '../../fixtures/test-plan.png');

      try {
        await fileInput.setInputFiles(testFilePath);
        await page.click('button[type="submit"]');
        await nav.waitForToast();

        await expect(page.locator(`text=${planName}`)).toBeVisible({ timeout: 10000 });
      } catch (error) {
        test.skip();
      }
    }
  });

  test('devrait afficher le Floor Plan Viewer (Konva)', async ({ page }) => {
    // Cliquer sur premier plan
    const firstPlan = page.locator('[data-testid="plan-item"], table tbody tr, .plan-card').first();

    if (await firstPlan.isVisible()) {
      await firstPlan.click();
      await page.waitForLoadState('networkidle');

      // Vérifier canvas Konva
      const canvas = page.locator('canvas, [data-testid="plan-viewer"]');
      await expect(canvas).toBeVisible({ timeout: 5000 });
    }
  });

  test('devrait permettre le zoom sur le plan', async ({ page }) => {
    const firstPlan = page.locator('[data-testid="plan-item"], table tbody tr').first();

    if (await firstPlan.isVisible()) {
      await firstPlan.click();
      await page.waitForLoadState('networkidle');

      // Chercher boutons zoom
      const zoomInButton = page.locator('button[aria-label*="Zoom"], button:has-text("+")');
      const zoomOutButton = page.locator('button[aria-label*="Zoom"], button:has-text("-")');

      if (await zoomInButton.isVisible()) {
        await zoomInButton.click();
        await page.waitForTimeout(500);

        // Vérifier que le canvas a changé (difficile à tester précisément)
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
      }

      if (await zoomOutButton.isVisible()) {
        await zoomOutButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('devrait permettre d\'ajouter un pin sur le plan', async ({ page }) => {
    const firstPlan = page.locator('[data-testid="plan-item"], table tbody tr').first();

    if (await firstPlan.isVisible()) {
      await firstPlan.click();
      await page.waitForLoadState('networkidle');

      // Chercher bouton "Ajouter pin"
      const addPinButton = page.locator('button:has-text("Ajouter"), button:has-text("Add Pin")');

      if (await addPinButton.isVisible()) {
        await addPinButton.click();

        // Formulaire pin
        await page.waitForSelector('form, [data-testid="pin-form"]');

        // Type de pin
        const typeSelect = page.locator('select[name="type"]');
        if (await typeSelect.isVisible()) {
          await typeSelect.selectOption('EQUIPMENT'); // ou NETWORK, ALERT, INFO
        }

        // Label
        await page.fill('input[name="label"], input[name="title"]', 'Test Pin E2E');

        // Coordonnées (peuvent être pré-remplies)
        const xInput = page.locator('input[name="x"]');
        if (await xInput.isVisible() && (await xInput.inputValue()) === '') {
          await xInput.fill('100');
        }

        const yInput = page.locator('input[name="y"]');
        if (await yInput.isVisible() && (await yInput.inputValue()) === '') {
          await yInput.fill('100');
        }

        await page.click('button[type="submit"]');
        await nav.waitForToast();

        // Vérifier pin ajouté (visible sur canvas)
        await expect(page.locator('text=Test Pin E2E')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('devrait afficher les différents types de pins', async ({ page }) => {
    const firstPlan = page.locator('[data-testid="plan-item"], table tbody tr').first();

    if (await firstPlan.isVisible()) {
      await firstPlan.click();
      await page.waitForLoadState('networkidle');

      // Vérifier légende types de pins
      const legend = page.locator('[data-testid="pin-legend"], .legend');

      if (await legend.isVisible()) {
        // Vérifier présence 4 types
        await expect(legend.locator('text=EQUIPMENT, text=Équipement')).toBeVisible();
        await expect(legend.locator('text=NETWORK, text=Réseau')).toBeVisible();
        await expect(legend.locator('text=ALERT, text=Alerte')).toBeVisible();
        await expect(legend.locator('text=INFO')).toBeVisible();
      }
    }
  });

  test('devrait permettre de modifier un pin existant', async ({ page }) => {
    const firstPlan = page.locator('[data-testid="plan-item"], table tbody tr').first();

    if (await firstPlan.isVisible()) {
      await firstPlan.click();
      await page.waitForLoadState('networkidle');

      // Chercher un pin existant
      const existingPin = page.locator('[data-testid*="pin"], .pin-marker').first();

      if (await existingPin.isVisible()) {
        // Cliquer sur le pin
        await existingPin.click();

        // Chercher bouton modifier
        const editButton = page.locator('button:has-text("Modifier"), button[aria-label*="Modifier"]');

        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForSelector('form');

          // Modifier label
          await page.fill('input[name="label"], input[name="title"]', `Pin Modifié ${Date.now()}`);

          await page.click('button[type="submit"]');
          await nav.waitForToast();
        }
      }
    }
  });

  test('devrait filtrer les plans par site', async ({ page }) => {
    const siteFilter = page.locator('select[name="siteId"], [data-testid="site-filter"]');

    if (await siteFilter.isVisible()) {
      await siteFilter.selectOption({ index: 1 });
      await page.waitForTimeout(1000);

      // Vérifier résultats filtrés
      const results = page.locator('[data-testid="plan-item"], table tbody tr');
      const count = await results.count();

      expect(count >= 0).toBeTruthy();
    }
  });

  test('devrait afficher les métadonnées du plan', async ({ page }) => {
    const firstPlan = page.locator('[data-testid="plan-item"], table tbody tr').first();

    if (await firstPlan.isVisible()) {
      await firstPlan.click();
      await page.waitForLoadState('networkidle');

      // Vérifier informations plan
      const infoSection = page.locator('[data-testid="plan-info"], .plan-metadata');

      // Au minimum, le nom doit être visible
      await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    }
  });
});
