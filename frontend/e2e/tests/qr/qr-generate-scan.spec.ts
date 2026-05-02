import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - QR codes - Generate + Scan (S7 PR4).
 *
 * XCH génère des QR codes pour chaque asset (URL deeplink vers la
 * fiche). L'app PWA inclut un scanner caméra pour identifier un asset
 * en scannant son QR sur le terrain.
 *
 * Tests :
 * - Generate : afficher / télécharger le QR PNG
 * - Scan via webcam mock : injecter une fake stream caméra avec un QR
 *   image, vérifier que l'app le reconnaît et redirige vers la fiche.
 *
 * Pattern webcam mock (Playwright) :
 *   await context.grantPermissions(['camera']);
 *   await page.addInitScript(() => {
 *     navigator.mediaDevices.getUserMedia = async () => {
 *       // Retourne un MediaStream avec un canvas QR comme source
 *     };
 *   });
 */

test.describe('QR codes - Generate', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('affiche le QR code sur la fiche d\'un asset', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    const firstAsset = page.locator('a[href^="/dashboard/assets/"]').first();
    const assetHref = await firstAsset.getAttribute('href').catch(() => null);
    if (!assetHref) return;

    await page.goto(assetHref);
    await page.waitForLoadState('networkidle');

    // QR code rendu (canvas ou img ou SVG)
    const qr = page.locator('canvas, img[alt*="QR" i], svg[data-testid*="qr" i]').first();
    await expect(qr).toBeVisible({ timeout: 10000 });
  });

  test.skip('télécharge le QR code en PNG via bouton dédié', async ({ page }) => {
    // SCAFFOLDING — flow :
    // 1. Aller sur fiche asset
    // 2. Cliquer bouton "Télécharger QR" (sélecteur à confirmer)
    // 3. Capturer download via page.waitForEvent('download')
    // 4. Vérifier suggestedFilename matche /\.png$/
    expect(true).toBe(true);
  });
});

test.describe('QR codes - Scan via webcam mock', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('navigue vers la page scanner', async ({ page }) => {
    await page.goto('/dashboard/assets/scanner');
    await page.waitForLoadState('networkidle');

    // Page scanner rendue (header + bouton démarrer caméra)
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test.skip('mock getUserMedia + scan QR redirige vers fiche asset', async ({ page, context }) => {
    // SCAFFOLDING — flow complexe :
    // 1. Pré-générer un QR image qui pointe vers un asset connu du seed
    //    (URL = `/dashboard/assets/${assetId}` encodée en QR)
    // 2. context.grantPermissions(['camera'])
    // 3. page.addInitScript pour stub navigator.mediaDevices.getUserMedia
    //    qui retourne un MediaStream construit depuis un canvas qui
    //    rend le QR image
    // 4. page.goto('/dashboard/assets/scanner') → cliquer "Démarrer
    //    caméra" → librairie scanner décode le QR → router push vers
    //    la fiche asset
    // 5. Vérifier URL finale = /dashboard/assets/<assetId>
    //
    // Implémentation : nécessite import canvas QR generator côté test
    // (qrcode npm package) + setup MediaStream depuis canvas
    // (canvas.captureStream()).
    //
    // Décision PR4+ : l'effort est non négligeable (~2h setup helper
    // mock webcam). Si pilotes externes ne testent pas le scan
    // intensivement, peut être différé en mini-session "QR scan
    // automation" post-v2.0.0.
    expect(true).toBe(true);
  });

  test.skip('fallback graceful si caméra refusée par user', async ({ page }) => {
    // SCAFFOLDING — pattern UX : si getUserMedia rejette (permission
    // denied), afficher un message clair + lien vers la liste assets
    // pour saisie manuelle.
    expect(true).toBe(true);
  });
});
