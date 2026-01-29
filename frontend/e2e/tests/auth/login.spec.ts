import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Authentification - Login
 *
 * Scénarios testés:
 * - Login réussi avec admin
 * - Login réussi avec différents rôles
 * - Login échoué (mauvais credentials)
 * - Redirection après login
 * - Persistance de session (via cookies HTTP-only)
 */

test.describe('Authentification - Login', () => {
  test.beforeEach(async ({ page }) => {
    // S'assurer qu'on est déconnecté
    await page.context().clearCookies();
    await page.goto('/login');
  });

  test('devrait afficher le formulaire de login', async ({ page }) => {
    // Vérifier présence du formulaire
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Vérifier labels
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
  });

  test('devrait se connecter avec admin', async ({ page, loginAsAdmin }) => {
    // Login via fixture
    await loginAsAdmin();

    // Vérifier redirection dashboard
    await expect(page).toHaveURL('/dashboard');

    // Vérifier présence éléments dashboard
    await expect(page.locator('h1, h2').last().first()).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
  });

  test('devrait se connecter avec manager', async ({ page, loginAsManager }) => {
    await loginAsManager();
    await expect(page).toHaveURL('/dashboard');
  });

  test('devrait se connecter avec technicien', async ({ page, loginAsTechnicien }) => {
    await loginAsTechnicien();
    await expect(page).toHaveURL('/dashboard');
  });

  test('devrait se connecter avec viewer', async ({ page, loginAsViewer }) => {
    await loginAsViewer();
    await expect(page).toHaveURL('/dashboard');
  });

  test('devrait échouer avec email invalide', async ({ page }) => {
    await page.fill('#email', 'invalid@email.com');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Attendre message d'erreur (div avec classe destructive ou texte erreur)
    await expect(page.locator('.bg-destructive\\/10, [role="alert"]')).toBeVisible({ timeout: 5000 });

    // Vérifier qu'on reste sur /login
    await expect(page).toHaveURL('/login');
  });

  test('devrait échouer avec mot de passe invalide', async ({ page }) => {
    await page.fill('#email', TEST_USERS.admin.email);
    await page.fill('#password', 'WrongPassword!');
    await page.click('button[type="submit"]');

    // Message d'erreur
    await expect(page.locator('.bg-destructive\\/10, [role="alert"]')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('devrait valider les champs requis', async ({ page }) => {
    // Soumettre formulaire vide
    await page.click('button[type="submit"]');

    // Vérifier validation HTML5
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Au moins un champ doit être en erreur (HTML5 validation)
    const emailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    const passwordInvalid = await passwordInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

    expect(emailInvalid || passwordInvalid).toBeTruthy();
  });

  test('devrait persister la session après rechargement', async ({ page, loginAsAdmin }) => {
    // Login
    await loginAsAdmin();

    // Recharger la page
    await page.reload();

    // Vérifier toujours sur dashboard (cookie HTTP-only persiste)
    await expect(page).toHaveURL('/dashboard');

    // Vérifier cookie accessToken présent
    const cookies = await page.context().cookies();
    const accessToken = cookies.find(c => c.name === 'accessToken');
    expect(accessToken).toBeTruthy();
  });

  test('devrait rediriger vers /dashboard si déjà connecté', async ({ page, loginAsAdmin }) => {
    // Login
    await loginAsAdmin();

    // Tenter d'accéder à /login
    await page.goto('/login');

    // Devrait rediriger vers /dashboard
    await page.waitForURL('/dashboard', { timeout: 5000 });
    await expect(page).toHaveURL('/dashboard');
  });
});
