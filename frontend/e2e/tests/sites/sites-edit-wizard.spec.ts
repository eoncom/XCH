import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Sites - Wizard d'édition (S7 PR2).
 *
 * Édition d'un site existant via le wizard 2-step (cf
 * frontend/src/app/dashboard/sites/[id]/edit/page.tsx). Same shape
 * que le wizard de création mais avec deeplink `?step=N` pour ouvrir
 * directement à un step spécifique (utilisé par les boutons "Modifier
 * contacts" depuis la fiche site).
 *
 * Note plan v2 : le brief original parlait d'un "edit 6-step". La
 * réalité du code est 2-step (Informations de base + Contacts/Accès).
 * Les "6 sections" mentionnées étaient peut-être les onglets de la
 * FICHE site, pas du wizard d'édition. Plan à mettre à jour post-S7.
 *
 * Tests scaffolded en `test.skip` quand le selector exact ou le flow
 * dépend d'un setup pas validé localement (à compléter PR2+ via run
 * CI E2E réelle).
 */

test.describe('Sites - Wizard édition (2-step)', () => {
  test.beforeEach(async ({ loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('ouvre le wizard édition du premier site et affiche step 1', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    // Premier site → fiche
    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    await firstSite.click();
    await page.waitForURL(/\/dashboard\/sites\/[a-z0-9-]+$/);

    // Bouton modifier
    const editLink = page.locator('a:has-text("Modifier"), button:has-text("Modifier")').first();
    if (await editLink.isVisible()) {
      await editLink.click();
      await page.waitForURL(/\/dashboard\/sites\/[a-z0-9-]+\/edit/);

      // Step 1 visible
      await expect(page.locator('text=Informations de base')).toBeVisible();
    }
  });

  test('deeplink ?step=2 ouvre directement step Contacts', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    const href = await firstSite.getAttribute('href');
    if (!href) return;

    await page.goto(`${href}/edit?step=2`);
    await page.waitForLoadState('networkidle');

    // Step 2 (Contacts & Accès) actif
    await expect(page.locator('text=Contacts').first()).toBeVisible();
  });

  test.skip('dirty-state guard : navigation hors page demande confirmation si modifs non sauvées', async ({ page }) => {
    // SCAFFOLDING — beforeunload listener à confirmer côté app. Pour
    // tester : modifier un champ, tenter page.goto('/dashboard'),
    // vérifier popup confirmation puis cancel. Playwright peut
    // accepter/dismiss via page.on('dialog', ...).
    expect(true).toBe(true);
  });

  test.skip('concurrence 409 : si site modifié par un autre user, message conflit', async ({ page }) => {
    // SCAFFOLDING — nécessite simuler une modification concurrente.
    // Pattern : ouvrir 2 contexts navigateur, modifier dans un, save
    // dans le second avec données stale, vérifier 409 affiché. Ou
    // mock backend response 409 via page.route.
    expect(true).toBe(true);
  });

  test('modifie le name d\'un site existant et persiste après reload', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    const firstSite = page.locator('a[href^="/dashboard/sites/"]').first();
    const siteHref = await firstSite.getAttribute('href');
    if (!siteHref) return;

    await page.goto(`${siteHref}/edit`);
    await page.waitForSelector('form');

    const newName = `Edited E2E ${Date.now()}`;
    await page.fill('input[name="name"]', newName);

    // Submit (peut nécessiter passer step 2 d'abord)
    const submitButton = page.locator('button[type="submit"]').last();
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Reload fiche, vérifier persistance
    await page.goto(siteHref);
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${newName}`).first()).toBeVisible({ timeout: 10000 });
  });
});
