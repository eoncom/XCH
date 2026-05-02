import { test, expect } from '../../fixtures/auth.fixture';
import { getKonvaCanvas, dragKonvaFromTo, uPositionToRelY } from '../../helpers/konva';

/**
 * Tests E2E - Racks - Mount Konva avancé (S7 PR4).
 *
 * Suite du fichier racks-mount-konva.spec.ts (PR2 basics). Cette spec
 * couvre les interactions Konva complexes :
 * - Multi-mount stack : monter plusieurs assets dans le même rack
 * - Resize asset 1U → 4U
 * - Rotation orientation
 * - Export rack PNG
 *
 * Stratégie : majoritairement skip TODO car nécessite instrumentation
 * de l'app pour exposer une API d'introspection Konva (ex: window.
 * __rackKonvaStage), OU passer par UI form-based équivalente.
 *
 * Helper Konva : `frontend/e2e/helpers/konva.ts` (créé en PR2).
 * Pour le drag&drop avancé, on utilise dragKonvaFromTo + uPositionToRelY
 * pour calculer les coordonnées relatives.
 */

test.describe('Racks - Mount Konva avancé', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('canvas Konva visible sur fiche rack peuplé du seed démo', async ({ page }) => {
    await page.goto('/dashboard/racks');
    await page.waitForLoadState('networkidle');

    const firstRack = page.locator('a[href^="/dashboard/racks/"]').first();
    const rackHref = await firstRack.getAttribute('href').catch(() => null);
    if (!rackHref) return;

    await page.goto(rackHref);
    await page.waitForLoadState('networkidle');

    const { bounds } = await getKonvaCanvas(page);
    expect(bounds.width).toBeGreaterThan(50);
    expect(bounds.height).toBeGreaterThan(100);
  });

  test.skip('multi-mount : monte 3 assets dans un rack 24U', async ({ page }) => {
    // SCAFFOLDING — flow attendu :
    // 1. Créer rack 24U
    // 2. Monter asset A à position U=10 (height 1U)
    // 3. Monter asset B à position U=15 (height 2U)
    // 4. Monter asset C à position U=20 (height 1U)
    // 5. Vérifier que le canvas affiche les 3 assets dans la bonne
    //    ordre (du bas vers le haut : A, B, C)
    // 6. Vérifier occupation rack = 4U/24U (16.67%)
    expect(true).toBe(true);
  });

  test.skip('resize : change un asset de 1U à 4U via UI form', async ({ page }) => {
    // SCAFFOLDING — l'attribut heightU de l'asset peut être édité
    // depuis sa fiche. Vérifier que le rack viewer reflète le nouveau
    // size et que les positions U au-dessus sont libérées si conflit.
    expect(true).toBe(true);
  });

  test.skip('rotation : change orientation asset rack-mount', async ({ page }) => {
    // SCAFFOLDING — UI rotation pas confirmée. Vérifier composant
    // RackVisualization si rotate prop disponible.
    expect(true).toBe(true);
  });

  test.skip('export rack en PNG via bouton "Télécharger"', async ({ page }) => {
    // SCAFFOLDING — pattern : page.waitForEvent('download') puis
    // click bouton export. Vérifier suggestedFilename matche /\.png$/.
    expect(true).toBe(true);
  });

  test.skip('drag&drop : déplace asset entre positions U', async ({ page }) => {
    // SCAFFOLDING — drag depuis la position courante de l'asset vers
    // une nouvelle position U. Utiliser dragKonvaFromTo + uPositionToRelY
    // pour calculer les coordonnées relatives. Vérifier que le backend
    // a bien set asset.rackPositionU à la nouvelle valeur.
    //
    // Exemple :
    // const heightU = 24;
    // const fromY = uPositionToRelY(10, heightU);
    // const toY = uPositionToRelY(20, heightU);
    // await dragKonvaFromTo(page, 0.5, fromY, 0.5, toY);
    expect(true).toBe(true);
  });
});
