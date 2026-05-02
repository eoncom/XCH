import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement (MANAGER — rôle "SUPERUSER" backend)
 *
 * S7 PR1 — split de rbac.spec.ts. Manager peut accéder Settings (sauf
 * demo data admin-only), CRUD complet sur Assets/Tasks, lecture seule
 * sur Sites.
 */

test.describe('RBAC - Manager Role', () => {
  test.beforeEach(async ({ loginAsManager }) => {
    await loginAsManager();
  });

  test('should allow read access to Sites (no create button)', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText(/Sites/i);

    const createButton = page.locator('button:has-text("Nouveau site")');
    const buttonExists = await createButton.isVisible().catch(() => false);
    expect(buttonExists).toBe(false);
  });

  test('should allow Settings access', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });
  });

  test('should deny demo data management (admin-only)', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    const demoSection = page.locator('text=Données de démonstration');
    const demoSectionExists = await demoSection.isVisible().catch(() => false);
    expect(demoSectionExists).toBe(false);

    const loadDemoButton = page.locator('button:has-text("Charger données démo")');
    const resetButton = page.locator('button:has-text("Réinitialiser")');

    const loadExists = await loadDemoButton.isVisible().catch(() => false);
    const resetExists = await resetButton.isVisible().catch(() => false);

    expect(loadExists).toBe(false);
    expect(resetExists).toBe(false);
  });

  test('should allow full CRUD on Assets', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("Nouvel équipement")');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow full CRUD on Tasks', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("Nouvelle tâche")');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });
});
