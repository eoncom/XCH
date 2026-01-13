import { test, expect, TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Authentification - Login
 *
 * Scénarios testés:
 * - Login réussi avec admin
 * - Login réussi avec différents rôles
 * - Login échoué (mauvais credentials)
 * - Redirection après login
 * - Persistance de session
 */

test.describe('Authentification - Login', () => {
  test.beforeEach(async ({ page }) => {
    // S'assurer qu'on est déconnecté
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
  });

  test('devrait afficher le formulaire de login', async ({ page }) => {
    // Vérifier présence du formulaire
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Vérifier labels
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Mot de passe, text=Password')).toBeVisible();
  });

  test('devrait se connecter avec admin', async ({ page, loginAsAdmin }) => {
    // Login via fixture
    await loginAsAdmin();

    // Vérifier redirection dashboard
    await expect(page).toHaveURL('/dashboard');

    // Vérifier présence éléments dashboard
    await expect(page.locator('h1, h2').first()).toBeVisible();
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
    await page.fill('input[name="email"]', 'invalid@email.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Attendre message d'erreur
    await expect(page.locator('[role="alert"], .error, text=Identifiants invalides, text=Invalid credentials')).toBeVisible({ timeout: 5000 });

    // Vérifier qu'on reste sur /login
    await expect(page).toHaveURL('/login');
  });

  test('devrait échouer avec mot de passe invalide', async ({ page }) => {
    await page.fill('input[name="email"]', TEST_USERS.admin.email);
    await page.fill('input[name="password"]', 'WrongPassword!');
    await page.click('button[type="submit"]');

    // Message d'erreur
    await expect(page.locator('[role="alert"], .error')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('devrait valider les champs requis', async ({ page }) => {
    // Soumettre formulaire vide
    await page.click('button[type="submit"]');

    // Vérifier validation HTML5 ou messages d'erreur
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    // Au moins un champ doit être en erreur
    const emailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    const passwordInvalid = await passwordInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

    expect(emailInvalid || passwordInvalid).toBeTruthy();
  });

  test('devrait persister la session après rechargement', async ({ page, loginAsAdmin }) => {
    // Login
    await loginAsAdmin();

    // Recharger la page
    await page.reload();

    // Vérifier toujours sur dashboard
    await expect(page).toHaveURL('/dashboard');

    // Vérifier token toujours présent
    const token = await page.evaluate(() => localStorage.getItem('xch_token'));
    expect(token).toBeTruthy();
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
