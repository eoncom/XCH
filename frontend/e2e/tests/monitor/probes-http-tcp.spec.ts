import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Monitoring - Probes HTTP + TCP (S7 PR3).
 *
 * Couvre les autres kinds de probes natives (cf ADR-014/016) :
 * - HTTP : check status code + content match (configurable via
 *   MonitorHttpConfig — expected_status, expected_body_contains)
 * - TCP : check port ouvert sur host:port
 * - Failure threshold : N échecs consécutifs avant alert
 * - Pause/resume : enabled flag toggle
 *
 * Tests scaffolded en `test.skip` quand le flow nécessite confirmation
 * UI exacte (Dialog "Nouveau probe" avec switch HTTP vs TCP, options
 * conditionnelles).
 *
 * Comme probes-icmp.spec.ts, les flow lifecycle complets nécessitent
 * une cible réelle pinguable + attente du scheduler. POST /:id/run-now
 * permet de forcer un check immédiat en test.
 */

test.describe('Monitor - Probes HTTP', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test.skip('crée un probe HTTP avec status code attendu 200', async ({ page }) => {
    // SCAFFOLDING — flow :
    // 1. Nouveau probe → kind=HTTP → target=https://example.com →
    //    expected_status=200
    // 2. Run-now → SUCCESS si example.com renvoie 200
    // 3. Edit probe : changer expected_status=404 → next run = FAILURE
    expect(true).toBe(true);
  });

  test.skip('crée un probe HTTP avec content match (expected_body_contains)', async ({ page }) => {
    // SCAFFOLDING — MonitorHttpConfig.expectedBodyContains permet de
    // valider qu'une chaîne est présente dans la response. Tester
    // avec example.com + "Example Domain" → SUCCESS.
    expect(true).toBe(true);
  });

  test.skip('failure threshold : 3 checks consécutifs FAILURE avant ALERT', async ({ page }) => {
    // SCAFFOLDING — la notion failureThreshold (défaut N=3) évite
    // les faux positifs sur un check ponctuel. Tester avec un probe
    // sur une cible inexistante + run-now 3x → après le 3e échec,
    // dispatch notification.
    expect(true).toBe(true);
  });

  test.skip('pause / resume probe via toggle enabled', async ({ page }) => {
    // SCAFFOLDING — switch UI sur la fiche probe. Quand disabled,
    // le scheduler skip ce probe (pas de nouveau MonitorResult).
    // Re-enable → reprend les checks au prochain interval.
    expect(true).toBe(true);
  });
});

test.describe('Monitor - Probes TCP', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test.skip('crée un probe TCP sur localhost:5432 (postgres en CI)', async ({ page }) => {
    // SCAFFOLDING — TCP probe vérifie que le port est ouvert
    // (handshake TCP réussi). En CI, postgres-e2e expose 5432 →
    // SUCCESS attendu. Pour cible réelle : utiliser 8.8.8.8:53
    // (Google DNS toujours UP).
    expect(true).toBe(true);
  });

  test.skip('TCP probe sur port fermé (localhost:9999) retourne FAILURE', async ({ page }) => {
    // SCAFFOLDING — vérification que le check FAILURE est bien
    // remonté avec errorMsg = "Connection refused" ou similaire.
    expect(true).toBe(true);
  });
});

test.describe('Monitor - Auto-disabled status', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('endpoint /api/monitors/auto-disabled/status accessible', async ({ page, request }) => {
    // Le module monitoring expose un endpoint pour les probes
    // auto-désactivés (suite à trop d'échecs). UI les affiche dans
    // un banner "MonitorsAutoDisabledBanner".
    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';
    const response = await request.get(`${apiUrl}/api/monitors/auto-disabled/status`, {
      headers: { Cookie: `accessToken=${accessToken.value}` },
    });

    // Doit retourner 200 (liste, possiblement vide)
    expect(response.ok()).toBeTruthy();
  });
});
