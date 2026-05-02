import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - RBAC Enforcement (MANAGER — rôle "SUPERUSER" backend)
 *
 * S7 PR1 — split de rbac.spec.ts.
 * S7.5 PR5e — adapté à AUTH_MODEL_V2 (MANAGE/WRITE/READ + AccessOverride,
 * cf XCH_AUTH_MODEL_V2 mémoire MCP). Sophie Martin (manager@demo.fr) a
 * MANAGE sur ses délégations dans le seed démo, donc CRUD complet sur
 * Sites/Assets/Tasks (pas de "lecture seule sur Sites" comme l'ancien
 * modèle Casbin le suggérait). Ce qui distingue manager de admin :
 * pas de Tenant tab dans Settings (tabs personnels seulement +
 * Ma délégation + Notifications). Pas de demo data management.
 */

test.describe('RBAC - Manager Role', () => {
  test.beforeEach(async ({ loginAsManager }) => {
    await loginAsManager();
  });

  test('should allow CRUD access to Sites (manager has MANAGE on delegation)', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Sites")')).toBeVisible({ timeout: 5000 });

    // S7.5 PR5e — manager dans seed démo a MANAGE → "Nouveau site" visible.
    // Le test legacy attendait l'inverse, ce qui correspondait à
    // l'ancien modèle Casbin retiré (cf XCH_AUTH_MODEL_V2).
    const createButton = page.locator('a[href="/dashboard/sites/new"]');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow Settings access with delegation tabs', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    // Manager voit Profil/Sécurité/Apparence + Ma délégation + Notifications.
    // PAS de Tenant/SSO/Modules/etc (super-admin only).
    await expect(page.getByRole('tab', { name: /Ma d.l.gation/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Notifications/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Tenant$/i })).not.toBeVisible();
  });

  test('should deny demo data management (Tenant tab admin-only)', async ({ page }) => {
    // S7.5 PR5e — le tab Tenant (qui contient demo data) n'est pas
    // rendu pour manager. Tenter de naviguer via ?tab=tenant tombe
    // sur le tab par défaut (profile) car le tab n'existe pas dans
    // la TabsList rendue.
    await page.goto('/dashboard/settings?tab=tenant');
    await expect(page.locator('h1:has-text("Paramètres")')).toBeVisible({ timeout: 5000 });

    const demoSectionExists = await page.locator('text=Données de démonstration').isVisible().catch(() => false);
    expect(demoSectionExists).toBe(false);

    const loadDemoExists = await page.locator('[data-testid="load-demo-data-btn"]').isVisible().catch(() => false);
    expect(loadDemoExists).toBe(false);
  });

  test('should allow full CRUD on Assets', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('a[href="/dashboard/assets/new"]');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow full CRUD on Tasks', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('a[href="/dashboard/tasks/new"]');
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });
});
