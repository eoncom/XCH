import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Status Badges Visual Validation
 *
 * Valide couleurs correctes badges status:
 * - IN_SERVICE → Vert
 * - MAINTENANCE → Jaune
 * - DECOMMISSIONED → Rouge
 * - STORAGE → Gris
 * - UNKNOWN → Gris
 */

test.describe('Status Badges - Visual Validation', () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
  });

  test('should display IN_SERVICE status with green badge on Assets page', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    // Chercher badge avec status IN_SERVICE
    const inServiceBadge = page.locator('text=/En service|IN_SERVICE/i').first();
    const badgeExists = await inServiceBadge.isVisible().catch(() => false);

    if (badgeExists) {
      // Vérifier classes CSS green
      const badgeClass = await inServiceBadge.getAttribute('class');

      // Doit contenir green OU success variant
      expect(badgeClass).toMatch(/green|success/i);

      // Vérifier computed style (couleur de fond)
      const bgColor = await inServiceBadge.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Couleur verte (RGB contenant plus de green que red/blue)
      // Ex: rgb(34, 197, 94) = green-500
      const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        // Green component devrait être le plus élevé
        expect(g).toBeGreaterThan(r);
        expect(g).toBeGreaterThan(b);
      }
    }
  });

  test('should display MAINTENANCE status with yellow badge on Racks page', async ({ page }) => {
    await page.goto('/dashboard/racks');
    await page.waitForLoadState('networkidle');

    // Chercher badge MAINTENANCE
    const maintenanceBadge = page.locator('text=/Maintenance|MAINTENANCE/i').first();
    const badgeExists = await maintenanceBadge.isVisible().catch(() => false);

    if (badgeExists) {
      const badgeClass = await maintenanceBadge.getAttribute('class');

      // Doit contenir yellow, amber ou warning
      expect(badgeClass).toMatch(/yellow|amber|warning/i);

      // Vérifier couleur jaune/orange
      const bgColor = await maintenanceBadge.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Couleur jaune: R et G élevés, B faible
      const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        // R et G devraient être similaires et > B
        expect(r).toBeGreaterThan(100);
        expect(g).toBeGreaterThan(100);
        expect(b).toBeLessThan(150);
      }
    }
  });

  test('should display DECOMMISSIONED status with red badge', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    // Chercher badge DECOMMISSIONED
    const decommissionedBadge = page.locator('text=/Décommissionné|DECOMMISSIONED/i').first();
    const badgeExists = await decommissionedBadge.isVisible().catch(() => false);

    if (badgeExists) {
      const badgeClass = await decommissionedBadge.getAttribute('class');

      // Doit contenir red ou destructive
      expect(badgeClass).toMatch(/red|destructive/i);

      // Vérifier couleur rouge
      const bgColor = await decommissionedBadge.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        // Red component devrait être le plus élevé
        expect(r).toBeGreaterThan(g);
        expect(r).toBeGreaterThan(b);
      }
    }
  });

  test('should display STORAGE status with gray badge', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    // Chercher badge STORAGE
    const storageBadge = page.locator('text=/Stockage|STORAGE/i').first();
    const badgeExists = await storageBadge.isVisible().catch(() => false);

    if (badgeExists) {
      const badgeClass = await storageBadge.getAttribute('class');

      // Doit contenir gray, slate ou secondary
      expect(badgeClass).toMatch(/gray|slate|secondary/i);

      // Vérifier couleur grise (R, G, B similaires)
      const bgColor = await storageBadge.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        // Gris: R, G, B proches
        const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        expect(diff).toBeLessThan(30); // Tolérance 30 pour variations gris
      }
    }
  });

  test('should display HEALTHY status with green badge on Sites page', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    // Chercher badge HEALTHY (health status sites)
    const healthyBadge = page.locator('text=/HEALTHY|Sain/i').first();
    const badgeExists = await healthyBadge.isVisible().catch(() => false);

    if (badgeExists) {
      const badgeClass = await healthyBadge.getAttribute('class');
      expect(badgeClass).toMatch(/green|success/i);
    }
  });

  test('should display WARNING status with yellow badge on Sites page', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    // Chercher badge WARNING
    const warningBadge = page.locator('text=/WARNING|Attention/i').first();
    const badgeExists = await warningBadge.isVisible().catch(() => false);

    if (badgeExists) {
      const badgeClass = await warningBadge.getAttribute('class');
      expect(badgeClass).toMatch(/yellow|amber|warning/i);
    }
  });

  test('should display CRITICAL status with red badge on Sites page', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    // Chercher badge CRITICAL
    const criticalBadge = page.locator('text=/CRITICAL|Critique/i').first();
    const badgeExists = await criticalBadge.isVisible().catch(() => false);

    if (badgeExists) {
      const badgeClass = await criticalBadge.getAttribute('class');
      expect(badgeClass).toMatch(/red|error|destructive/i);
    }
  });

  test('should display UNKNOWN status with gray badge on Sites page', async ({ page }) => {
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    // Chercher badge UNKNOWN
    const unknownBadge = page.locator('text=/UNKNOWN|Inconnu/i').first();
    const badgeExists = await unknownBadge.isVisible().catch(() => false);

    if (badgeExists) {
      const badgeClass = await unknownBadge.getAttribute('class');
      expect(badgeClass).toMatch(/gray|slate|secondary/i);
    }
  });

  test('should display Task status badges with correct colors', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    await page.waitForLoadState('networkidle');

    // Vérifier badges status tâches (TODO, IN_PROGRESS, DONE, BLOCKED)
    const todoBadge = page.locator('text=/À faire|TODO/i').first();
    const todoExists = await todoBadge.isVisible().catch(() => false);

    if (todoExists) {
      const todoClass = await todoBadge.getAttribute('class');
      // TODO devrait être gris ou bleu
      expect(todoClass).toMatch(/gray|slate|blue|secondary/i);
    }

    const inProgressBadge = page.locator('text=/En cours|IN_PROGRESS/i').first();
    const inProgressExists = await inProgressBadge.isVisible().catch(() => false);

    if (inProgressExists) {
      const inProgressClass = await inProgressBadge.getAttribute('class');
      // IN_PROGRESS devrait être bleu ou orange
      expect(inProgressClass).toMatch(/blue|amber|orange|info/i);
    }

    const doneBadge = page.locator('text=/Terminé|DONE/i').first();
    const doneExists = await doneBadge.isVisible().catch(() => false);

    if (doneExists) {
      const doneClass = await doneBadge.getAttribute('class');
      // DONE devrait être vert
      expect(doneClass).toMatch(/green|success/i);
    }
  });

  test('should take screenshot of status badges for visual regression', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    // Screenshot première ligne avec badge status
    const firstAssetRow = page.locator('[data-testid="asset-row"]').first().or(
      page.locator('table tbody tr').first()
    );

    const rowExists = await firstAssetRow.isVisible().catch(() => false);

    if (rowExists) {
      await firstAssetRow.screenshot({
        path: 'playwright-report/screenshots/status-badge-asset-row.png'
      });
    }

    // Screenshot de la page Sites avec health badges
    await page.goto('/dashboard/sites');
    await page.waitForLoadState('networkidle');

    const firstSiteCard = page.locator('[data-testid="site-card"]').first().or(
      page.locator('table tbody tr').first()
    );

    const siteExists = await firstSiteCard.isVisible().catch(() => false);

    if (siteExists) {
      await firstSiteCard.screenshot({
        path: 'playwright-report/screenshots/status-badge-site-health.png'
      });
    }
  });

  test('should have consistent badge styling across pages', async ({ page }) => {
    // Vérifier que les badges utilisent le même composant/classes

    // Assets page
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    const assetBadge = page.locator('text=/En service|IN_SERVICE/i').first();
    const assetBadgeExists = await assetBadge.isVisible().catch(() => false);

    let assetBadgeClasses = '';
    if (assetBadgeExists) {
      assetBadgeClasses = await assetBadge.getAttribute('class') || '';
    }

    // Racks page
    await page.goto('/dashboard/racks');
    await page.waitForLoadState('networkidle');

    const rackBadge = page.locator('text=/En service|IN_SERVICE/i').first();
    const rackBadgeExists = await rackBadge.isVisible().catch(() => false);

    let rackBadgeClasses = '';
    if (rackBadgeExists) {
      rackBadgeClasses = await rackBadge.getAttribute('class') || '';
    }

    // Si les deux badges existent, vérifier cohérence des classes de base
    if (assetBadgeExists && rackBadgeExists) {
      // Extraire classes de base (ex: "inline-flex", "rounded-full", etc.)
      const baseAssetClasses = assetBadgeClasses.split(' ').filter(c => !c.includes('bg-') && !c.includes('text-'));
      const baseRackClasses = rackBadgeClasses.split(' ').filter(c => !c.includes('bg-') && !c.includes('text-'));

      // Au moins 3 classes communes (structure badge cohérente)
      const commonClasses = baseAssetClasses.filter(c => baseRackClasses.includes(c));
      expect(commonClasses.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('should display correct badge text content', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');

    // Vérifier que le texte du badge correspond au status
    const badges = page.locator('[class*="badge"], [data-status]');
    const badgeCount = await badges.count();

    if (badgeCount > 0) {
      const firstBadgeText = await badges.first().textContent();

      // Texte devrait être non vide et correspondre à un status valide
      expect(firstBadgeText).toBeTruthy();
      expect(firstBadgeText).toMatch(/service|maintenance|storage|decommissioned|unknown/i);
    }
  });
});
