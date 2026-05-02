import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Notifications - Inbox (S7 PR4).
 *
 * L'inbox notifications est accessible via la cloche header (icône
 * NotificationInbox) qui affiche le compteur unread + une liste
 * déroulante des dernières notifs. Une page dédiée /dashboard/
 * notifications liste l'historique complet avec filtres.
 *
 * Endpoints (cf backend/src/modules/notifications) :
 * - GET /api/notifications/inbox/me — liste paginée
 * - GET /api/notifications/inbox/count-unread — compteur unread
 * - PATCH /api/notifications/inbox/:id/read — marquer une comme lue
 * - POST /api/notifications/inbox/mark-all-read — marquer toutes lues
 * - DELETE /api/notifications/inbox/:id — supprimer
 */

test.describe('Notifications - Inbox', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('cloche header visible avec compteur (peut être 0)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Icône cloche dans le header (composant NotificationInbox)
    const bell = page.locator('button[aria-label*="notification" i], [data-testid="notification-bell"]').first();
    await expect(bell).toBeVisible({ timeout: 5000 });
  });

  test('page /dashboard/notifications liste l\'historique', async ({ page }) => {
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle');

    // Header de la page
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('endpoint count-unread répond 200 et retourne un nombre', async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';
    const response = await request.get(`${apiUrl}/api/notifications/inbox/count-unread`, {
      headers: { Cookie: `accessToken=${accessToken.value}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(typeof data.count === 'number' || typeof data === 'number').toBeTruthy();
  });

  test.skip('clic sur cloche ouvre le dropdown avec liste notifs', async ({ page }) => {
    // SCAFFOLDING — sélecteur dropdown à confirmer (Radix Popover ?)
    expect(true).toBe(true);
  });

  test.skip('mark-as-read : décrément compteur unread après PATCH /:id/read', async ({ page }) => {
    // SCAFFOLDING — flow :
    // 1. Snapshot count-unread initial (N)
    // 2. Cliquer "Marquer comme lue" sur une notif
    // 3. Vérifier count-unread = N-1
    expect(true).toBe(true);
  });

  test.skip('filtre par type : seules les notifs du type sélectionné s\'affichent', async ({ page }) => {
    // SCAFFOLDING — UI filtre par kind (TASK_ASSIGNED, BUDGET_WARNING,
    // MONITOR_ALERT, etc.) à confirmer dans page notifications.
    expect(true).toBe(true);
  });

  test.skip('pagination : charge plus de notifs au scroll bas', async ({ page }) => {
    // SCAFFOLDING — vérifier infinite scroll ou bouton "Charger plus".
    // Endpoint inbox/me supporte ?offset= et ?limit=.
    expect(true).toBe(true);
  });
});
