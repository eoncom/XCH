import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Dashboard Tiles Navigation
 *
 * Valide que les tuiles du dashboard sont cliquables et naviguent correctement
 * Issue: Dashboard tiles doivent être des liens cliquables
 */

test.describe('Dashboard - Tiles Navigation', () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    // Login admin avant chaque test
    await loginAsAdmin();
    await page.goto('/dashboard');

    // Attendre que le dashboard soit chargé
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });

  test('should display all dashboard stat tiles', async ({ page }) => {
    // Vérifier que toutes les tuiles sont visibles
    await expect(page.locator('[data-testid="dashboard-tile-sites"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-tile-assets"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-tile-tasks"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-tile-racks"]')).toBeVisible();
  });

  test('should navigate to Sites when clicking Sites tile', async ({ page }) => {
    // Vérifier que la tuile Sites est un lien
    const sitesTile = page.locator('a[href="/dashboard/sites"]').first();
    await expect(sitesTile).toBeVisible();

    // Cliquer sur la tuile
    await sitesTile.click();

    // Vérifier navigation
    await expect(page).toHaveURL('/dashboard/sites');
    await expect(page.locator('h1')).toContainText('Sites');
  });

  test('should navigate to Assets when clicking Assets tile', async ({ page }) => {
    const assetsTile = page.locator('a[href="/dashboard/assets"]').first();
    await expect(assetsTile).toBeVisible();

    await assetsTile.click();
    await expect(page).toHaveURL('/dashboard/assets');
    await expect(page.locator('h1')).toContainText('Assets');
  });

  test('should navigate to Tasks when clicking Tasks tile', async ({ page }) => {
    const tasksTile = page.locator('a[href="/dashboard/tasks"]').first();
    await expect(tasksTile).toBeVisible();

    await tasksTile.click();
    await expect(page).toHaveURL('/dashboard/tasks');
    await expect(page.locator('h1')).toContainText('Tâches');
  });

  test('should navigate to Racks when clicking Racks tile', async ({ page }) => {
    const racksTile = page.locator('a[href="/dashboard/racks"]').first();
    await expect(racksTile).toBeVisible();

    await racksTile.click();
    await expect(page).toHaveURL('/dashboard/racks');
    await expect(page.locator('h1')).toContainText('Baies');
  });

  test('tiles should have cursor pointer on hover', async ({ page }) => {
    const sitesTile = page.locator('a[href="/dashboard/sites"]').first();

    // Vérifier que le curseur devient pointer (CSS class cursor-pointer)
    await expect(sitesTile).toHaveClass(/cursor-pointer/);
  });

  test('tiles should have hover effect', async ({ page }) => {
    const sitesTile = page.locator('a[href="/dashboard/sites"]').first();

    // Vérifier présence classes hover
    const classAttr = await sitesTile.getAttribute('class');
    expect(classAttr).toContain('hover:shadow-md');
  });

  test('should allow navigation back to dashboard from other pages', async ({ page }) => {
    // Naviguer vers Sites via tuile
    await page.click('a[href="/dashboard/sites"]');
    await expect(page).toHaveURL('/dashboard/sites');

    // Cliquer sur "Dashboard" dans navigation/breadcrumb
    await page.click('a[href="/dashboard"]');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });

  test('tiles should display correct counts', async ({ page }) => {
    // Vérifier que les compteurs sont des nombres (pas "NaN" ou vides)
    const sitesCount = page.locator('a[href="/dashboard/sites"]').locator('text=/^\\d+$/').first();
    const assetsCount = page.locator('a[href="/dashboard/assets"]').locator('text=/^\\d+$/').first();
    const tasksCount = page.locator('a[href="/dashboard/tasks"]').locator('text=/^\\d+$/').first();
    const racksCount = page.locator('a[href="/dashboard/racks"]').locator('text=/^\\d+$/').first();

    // Attendre que les compteurs soient visibles
    await expect(sitesCount).toBeVisible();
    await expect(assetsCount).toBeVisible();
    await expect(tasksCount).toBeVisible();
    await expect(racksCount).toBeVisible();

    // Vérifier que ce sont bien des nombres >= 0
    const sitesText = await sitesCount.textContent();
    const assetsText = await assetsCount.textContent();
    const tasksText = await tasksCount.textContent();
    const racksText = await racksCount.textContent();

    expect(parseInt(sitesText || '0')).toBeGreaterThanOrEqual(0);
    expect(parseInt(assetsText || '0')).toBeGreaterThanOrEqual(0);
    expect(parseInt(tasksText || '0')).toBeGreaterThanOrEqual(0);
    expect(parseInt(racksText || '0')).toBeGreaterThanOrEqual(0);
  });
});
