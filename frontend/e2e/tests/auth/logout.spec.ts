import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Authentification - Logout
 *
 * Scénarios testés:
 * - Logout réussi
 * - Suppression du token
 * - Redirection vers /login
 * - Protection des routes après logout
 */

test.describe('Authentification - Logout', () => {
  test('devrait se déconnecter correctement', async ({ page, loginAsAdmin, logout }) => {
    // Login d'abord
    await loginAsAdmin();
    await expect(page).toHaveURL('/dashboard');

    // Logout
    await logout();

    // Vérifier redirection vers /login
    await expect(page).toHaveURL('/login');

    // Vérifier suppression token
    const token = await page.evaluate(() => localStorage.getItem('xch_token'));
    expect(token).toBeNull();
  });

  test('devrait bloquer accès dashboard après logout', async ({ page, loginAsAdmin, logout }) => {
    // Login puis logout
    await loginAsAdmin();
    await logout();

    // Tenter d'accéder au dashboard
    await page.goto('/dashboard');

    // Devrait rediriger vers /login
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('devrait bloquer accès routes protégées après logout', async ({ page, loginAsAdmin, logout }) => {
    await loginAsAdmin();
    await logout();

    // Tester plusieurs routes protégées
    const protectedRoutes = [
      '/dashboard/sites',
      '/dashboard/assets',
      '/dashboard/tasks',
      '/dashboard/racks',
      '/dashboard/users',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL('/login', { timeout: 5000 });
      await expect(page).toHaveURL('/login');
    }
  });

  test('devrait permettre un nouveau login après logout', async ({ page, loginAsAdmin, logout }) => {
    // Premier login/logout
    await loginAsAdmin();
    await logout();

    // Deuxième login
    await loginAsAdmin();

    // Vérifier succès
    await expect(page).toHaveURL('/dashboard');
    const token = await page.evaluate(() => localStorage.getItem('xch_token'));
    expect(token).toBeTruthy();
  });
});
