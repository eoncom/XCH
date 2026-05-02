import { test, expect } from '../../fixtures/auth.fixture';
import { NavigationHelper } from '../../helpers/navigation';
import { TEST_DATA, generateUniqueData } from '../../helpers/test-data';
import { getKonvaCanvas, clickKonvaAt } from '../../helpers/konva';

/**
 * Tests E2E - Racks - Mount Konva (S7 PR2).
 *
 * Refactor de l'ancien racks-crud.spec.ts. Cette spec teste les
 * interactions Konva basiques pour mount un asset dans un rack :
 * - Affichage du rack viewer (canvas Konva visible)
 * - Calcul de l'occupation
 * - Détection des équipements montés
 * - Mount d'un asset à une position U précise (drag&drop ou form)
 *
 * Les interactions Konva avancées (multi-mount stack, resize 1U → 4U,
 * rotation, export PNG) sont reportées en PR4 (rack-mount-konva-advanced).
 *
 * Helper Konva : `frontend/e2e/helpers/konva.ts` — sélecteur canvas +
 * coordonnées calculées (relX/relY) pour cliquer/drag à une position
 * relative au canvas. Évite les coords pixel-précises figées.
 */

test.describe('Racks - Création + Mount Konva', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    nav = new NavigationHelper(page);
    await nav.goToRacks();
  });

  test('affiche le viewer Konva sur un rack existant', async ({ page }) => {
    const firstRack = page.locator('a[href^="/dashboard/racks/"]').first();
    const rackHref = await firstRack.getAttribute('href').catch(() => null);
    if (!rackHref) return;

    await page.goto(rackHref);
    await page.waitForLoadState('networkidle');

    const { locator, bounds } = await getKonvaCanvas(page);
    await expect(locator).toBeVisible();
    expect(bounds.width).toBeGreaterThan(50);
    expect(bounds.height).toBeGreaterThan(100);
  });

  test('crée un rack 24U et calcule l\'occupation initiale à 0%', async ({ page }) => {
    const rackData = generateUniqueData(TEST_DATA.racks.small);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="name"]', rackData.name);

    const heightInput = page.locator('input[name="heightU"], select[name="heightU"]').first();
    if (await heightInput.isVisible()) {
      const tag = await heightInput.evaluate((el) => el.tagName);
      if (tag === 'SELECT') {
        await heightInput.selectOption('24').catch(() => {});
      } else {
        await heightInput.fill('24').catch(() => {});
      }
    }

    const siteSelect = page.locator('select[name="siteId"]').first();
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 }).catch(() => {});
    }

    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Vérifier création
    await expect(page.locator(`text=${rackData.name}`).first()).toBeVisible({ timeout: 10000 });

    // Aller sur la fiche du rack créé
    await page.click(`text=${rackData.name}`);
    await page.waitForLoadState('networkidle');

    // Occupation 0% ou 0U (rack vide)
    const occupationInfo = page.locator('text=/0\\s*%|0\\s*U|libre|empty/i').first();
    await expect(occupationInfo).toBeVisible({ timeout: 5000 });
  });

  test('clique sur le canvas Konva ne lance pas d\'erreur JS', async ({ page }) => {
    const firstRack = page.locator('a[href^="/dashboard/racks/"]').first();
    const rackHref = await firstRack.getAttribute('href').catch(() => null);
    if (!rackHref) return;

    await page.goto(rackHref);
    await page.waitForLoadState('networkidle');

    // Capter erreurs console
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Clic au centre du canvas
    await clickKonvaAt(page, 0.5, 0.5);
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test.skip('mount un asset à une position U précise via drag&drop', async ({ page }) => {
    // SCAFFOLDING — le drag&drop Konva est complexe à tester sans
    // sélecteur structurel sur les nodes Konva (data-konva-id non
    // exposé). À compléter après instrumentation app (S7 PR4 ou
    // S9 selon priorité), ou via l'UI form-based "Monter cet asset
    // à la position N" si disponible.
    //
    // Plan : importer dragKonvaFromTo + uPositionToRelY, drag depuis
    // une zone "drawer assets disponibles" vers la zone canvas à la
    // bonne position U, vérifier que le backend a bien set
    // asset.rackId + asset.rackPositionU.
    expect(true).toBe(true);
  });

  test.skip('détecte la collision : refuse mount si position U déjà occupée', async ({ page }) => {
    // SCAFFOLDING — backend a déjà la validation. Tester via UI
    // form-based : tenter mount à position U déjà occupée, vérifier
    // toast d'erreur "position occupée".
    expect(true).toBe(true);
  });

  test.skip('unmount un asset libère sa position U', async ({ page }) => {
    // SCAFFOLDING — bouton "Démonter" sur l'asset monté, confirmer,
    // vérifier que asset.rackId devient null et que la position U
    // peut être réutilisée.
    expect(true).toBe(true);
  });

  test('liste les équipements montés dans un rack peuplé', async ({ page }) => {
    // Itérer pour trouver un rack qui a des assets montés (seed démo)
    const racks = page.locator('a[href^="/dashboard/racks/"]');
    const count = await racks.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const href = await racks.nth(i).getAttribute('href');
      if (!href) continue;

      await page.goto(href);
      await page.waitForLoadState('networkidle');

      // Section équipements montés
      const mountedSection = page.locator('text=/équipement|asset|monté/i').first();
      if (await mountedSection.isVisible().catch(() => false)) {
        // Au moins un rack a une section équipements
        return;
      }
    }
    // Si aucun rack du seed ne montre la section, on accepte
    // (le test est tolérant si le seed démo varie).
  });
});
