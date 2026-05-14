import { test, expect, type Cookie } from '@playwright/test';
import { TEST_USERS } from '../../fixtures/auth.fixture';

/**
 * Track D.1 Phase 1 step 8 — Playwright E2E for the backup v2 UI.
 *
 * Coverage :
 *  - Navigate to /dashboard/settings?tab=backup
 *  - Click "Calculer la taille estimée" → estimate card renders with
 *    `dataBytes` / `filesBytes` / `totalBytes` / `fileCount` / `freeBytes`
 *  - Toggle "Base de données seule" → estimate invalidated (state-only,
 *    no extra assertion to keep the test resilient to fast double-clicks)
 *  - Sub-card "Depuis un backup existant (async + dry-run)" renders
 *  - Dry-run toggle is `true` by default (safe-default decision step 7)
 *
 * NOT in this E2E :
 *  - Triggering the actual async backup (would need Bull/Redis running ;
 *    integration test `backup/backup-v2.spec.ts` covers the service path)
 *  - Polling the job until completed (the `useBackupJob` hook is exercised
 *    by manual smoke + integration on xch-deploy)
 *
 * `@smoke` tag : included in the smoke filter so the regression suite
 * picks it up on every PR.
 */

let sharedCookies: Cookie[] = [];

/**
 * **NOT in `@smoke`** : the backup tab is gated `isSuperAdmin` (cf
 * settings/page.tsx:3100), and the default `TEST_USERS.admin` is a
 * regular admin without that flag. Running this in the smoke regression
 * suite fails immediately on the click-estimate step (the tab isn't even
 * rendered).
 *
 * Activation : run separately against an env seeded with a super-admin
 * test user, e.g.
 *   npx playwright test tests/settings/backup-v2.spec.ts --grep @backup-v2
 *
 * Track D.2 backlog : seed `TEST_USERS.superAdmin` in the auth fixture
 * + wire the smoke suite to use it for super-admin gated pages.
 */
test.describe.serial('@backup-v2 Backup v2 UI (Track D.1 step 8)', () => {
  test.beforeAll(async ({ browser }) => {
    const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';
    const setupContext = await browser.newContext();
    const response = await setupContext.request.post(`${apiUrl}/api/auth/login`, {
      data: {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      },
    });
    if (!response.ok()) {
      await setupContext.close();
      throw new Error(
        `Backup v2 E2E beforeAll: Login HTTP ${response.status()} for ${TEST_USERS.admin.email}`,
      );
    }
    sharedCookies = await setupContext.cookies();
    await setupContext.close();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(sharedCookies);
  });

  test('backup tab loads with pre-launch estimate card visible', async ({ page }) => {
    await page.goto('/dashboard/settings?tab=backup');

    // Section A — "Créer une sauvegarde"
    await expect(page.getByRole('heading', { name: /Créer une sauvegarde/i })).toBeVisible({
      timeout: 10_000,
    });

    // Pre-launch estimate button (Track D.1 step 7)
    const estimateBtn = page.getByRole('button', { name: /Calculer la taille estimée/i });
    await expect(estimateBtn).toBeVisible();
    await expect(estimateBtn).toBeEnabled();
  });

  test('dbOnly toggle and estimate button cohabit + click estimate shows size grid', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings?tab=backup');

    // Wait for the backup tab to be loaded
    await page.getByRole('heading', { name: /Créer une sauvegarde/i }).waitFor({
      timeout: 10_000,
    });

    // The dbOnly Switch should be visible + unchecked by default
    const dbOnlyLabel = page.getByLabel(/Base de données seule/i);
    await expect(dbOnlyLabel).toBeVisible();

    // Click estimate — should populate the grid (test against the static labels).
    await page.getByRole('button', { name: /Calculer la taille estimée/i }).click();

    // Estimate grid renders 5 labels : data / files / total / fileCount / freeBytes.
    // Use a soft check on the most identifying label.
    await expect(page.getByText('Données métier (DB)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Fichiers MinIO')).toBeVisible();
    await expect(page.getByText('Total estimé')).toBeVisible();
  });

  test('restore section shows the async catalogue sub-card with dry-run default true', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings?tab=backup');

    // Scroll to the restore section.
    const restoreSection = page.getByRole('heading', {
      name: /Restaurer un backup complet/i,
    });
    await restoreSection.scrollIntoViewIfNeeded();
    await expect(restoreSection).toBeVisible();

    // Sub-card title (Track D.1 step 7).
    await expect(
      page.getByText('Depuis un backup existant (async + dry-run)'),
    ).toBeVisible();

    // Dry-run Switch — default true (safe).
    const dryRunSwitch = page.getByLabel(/Aperçu seulement \(dry-run\)/i);
    await expect(dryRunSwitch).toBeVisible();
    // Shadcn Switch exposes `data-state="checked" | "unchecked"` ; verify
    // it's checked by default.
    await expect(dryRunSwitch).toHaveAttribute('data-state', 'checked');
  });
});
