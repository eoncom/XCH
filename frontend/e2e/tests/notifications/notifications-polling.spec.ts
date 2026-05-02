import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Notifications - Polling + de-dup (S7 PR4).
 *
 * Le composant NotificationInbox poll l'endpoint count-unread toutes
 * les ~60s par défaut (cf v1.3 ADR-013). Pour les tests, override
 * via env `NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL=2000` (2s) pour
 * accélérer les assertions.
 *
 * De-dup : si plusieurs polls arrivent avant qu'une notif soit
 * acquittée, le compteur ne doit pas être double-incrémenté côté UI
 * (le backend retourne le count actuel, le frontend affiche cette
 * valeur sans agrégation locale).
 *
 * SSE fallback : si dispo (post-v1.4), un EventSource peut remplacer
 * le polling pour notifications real-time.
 */

test.describe('Notifications - Polling', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('intercepte au moins un appel GET /api/notifications/inbox/count-unread', async ({ page }) => {
    const apiCalls: number[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/notifications/inbox/count-unread') && req.method() === 'GET') {
        apiCalls.push(Date.now());
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Attendre le 1er poll (devrait fire au mount du composant)
    await page.waitForTimeout(3000);

    expect(apiCalls.length).toBeGreaterThanOrEqual(1);
  });

  test.skip('polling fire à intervalle régulier (avec env override 2s)', async ({ page }) => {
    // SCAFFOLDING — nécessite env NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL=2000
    // au build du frontend en CI E2E. Sinon, le polling 60s est trop
    // long pour un test (timeout). À configurer dans e2e-tests.yml ou
    // docker-compose.e2e.yml.
    expect(true).toBe(true);
  });

  test.skip('nouvelle notif arrive → compteur s\'incrémente sans reload manuel', async ({ page }) => {
    // SCAFFOLDING — flow :
    // 1. Snapshot compteur initial
    // 2. POST direct côté backend pour créer une UserNotification
    //    (ou trigger via assignation tâche, dispatch budget threshold)
    // 3. Attendre 3-5s pour que le polling refetch
    // 4. Vérifier compteur incrémenté
    expect(true).toBe(true);
  });

  test.skip('de-dup : double poll consécutif ne double-incrémente pas le compteur', async ({ page }) => {
    // SCAFFOLDING — vérifier que le UI affiche la valeur backend telle
    // quelle (pas d'agrégation locale qui pourrait double compter).
    expect(true).toBe(true);
  });

  test.skip('SSE fallback : si EventSource dispo, le polling est désactivé', async ({ page }) => {
    // SCAFFOLDING — feature post-v1.4. Vérifier que window.EventSource
    // est utilisé en priorité, polling fallback uniquement si SSE échoue.
    expect(true).toBe(true);
  });
});
