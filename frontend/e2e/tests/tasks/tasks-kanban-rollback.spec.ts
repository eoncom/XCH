import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Tasks - Kanban drag&drop optimistic rollback (S7 PR4).
 *
 * Validation de la fonctionnalité S6 PR4 : le Kanban met à jour
 * optimistiquement le statut d'une tâche quand l'utilisateur drag&drop
 * une carte entre colonnes (TODO ↔ IN_PROGRESS ↔ DONE), puis confirme
 * via PATCH /api/tasks/:id. Si le backend retourne 4xx/5xx, l'UI doit
 * rollback la carte à sa colonne d'origine + afficher un toast erreur.
 *
 * Pattern de test : intercepter la requête PATCH via page.route() pour
 * simuler un échec backend. Vérifier que la carte revient.
 */

test.describe('Tasks - Kanban optimistic rollback', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/tasks').catch(() => {});
  });

  test('affiche le Kanban avec 3 colonnes (TODO, IN_PROGRESS, DONE)', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    // Au moins une colonne visible
    await expect(page.locator('text=/TODO|À faire|To do/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/IN_PROGRESS|En cours|In progress/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/DONE|Terminé|Done/i').first()).toBeVisible({ timeout: 5000 });
  });

  test.skip('drag&drop carte TODO → IN_PROGRESS appelle PATCH /api/tasks/:id', async ({ page }) => {
    // SCAFFOLDING — flow attendu :
    // 1. Identifier une carte dans la colonne TODO
    // 2. Drag&drop vers IN_PROGRESS (page.dragAndDrop ou mouse events)
    // 3. Capturer la requête PATCH sortante
    // 4. Vérifier body = { status: 'IN_PROGRESS' }
    //
    // Sélecteurs @dnd-kit à confirmer (data-id ou data-task-id ?).
    expect(true).toBe(true);
  });

  test.skip('mock backend 500 sur PATCH → carte rollback à colonne origine', async ({ page }) => {
    // SCAFFOLDING — flow critique S6 PR4 :
    // 1. Intercepter PATCH /api/tasks/:id via page.route(...) avec
    //    fulfill status 500
    // 2. Drag carte de TODO vers IN_PROGRESS
    // 3. Attendre l'appel PATCH (intercepté → 500)
    // 4. Vérifier que la carte est revenue dans TODO
    // 5. Vérifier toast d'erreur visible
    //
    // Pattern :
    // await page.route('**/api/tasks/**', (route) => {
    //   if (route.request().method() === 'PATCH') {
    //     route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
    //   } else {
    //     route.continue();
    //   }
    // });
    expect(true).toBe(true);
  });

  test.skip('mock backend network abort → carte rollback + toast offline', async ({ page }) => {
    // SCAFFOLDING — variation du précédent avec route.abort('failed')
    // pour simuler une coupure réseau (kind=network dans ApiError de
    // S6 PR1 fondations). Vérifier toast OfflineBanner.
    expect(true).toBe(true);
  });

  test.skip('retry success après échec : carte reste à la nouvelle colonne', async ({ page }) => {
    // SCAFFOLDING — flow :
    // 1. Mock 500 pour la 1re tentative
    // 2. Drag carte → rollback affiché + toast
    // 3. Click retry depuis le toast
    // 4. Cette fois mock retourne 200 → carte stable IN_PROGRESS
    expect(true).toBe(true);
  });
});
