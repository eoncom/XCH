import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - Tasks Checklist Functionality
 *
 * Valide fonctionnement checklist tâches:
 * - Affichage items existants
 * - Toggle item (cocher/décocher)
 * - Ajout nouvel item
 * - Suppression item
 * - Persistance après reload
 */

test.describe('Tasks - Checklist Functionality', () => {
  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    await page.goto('/dashboard/tasks');

    // Attendre chargement liste tâches
    await expect(page.locator('h1:has-text("Tâches")')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to task detail page', async ({ page }) => {
    // Cliquer sur première tâche (card ou ligne table)
    const firstTask = page.locator('a[href^="/dashboard/tasks/"]').first();
    const taskExists = await firstTask.isVisible().catch(() => false);

    if (!taskExists) {
      // Si pas de tâches, créer une tâche de test
      await page.click('button:has-text("Nouvelle tâche")');
      await page.waitForSelector('form, [role="dialog"]');

      await page.fill('[name="title"]', 'Task E2E Checklist Test');
      await page.fill('[name="description"]', 'Test checklist functionality');

      // Type/Priority/Status si requis
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);
    } else {
      await firstTask.click();
      await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);
    }

    // Vérifier qu'on est sur page détail tâche
    await expect(page).toHaveURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);
  });

  test('should display checklist section if present', async ({ page }) => {
    // Ouvrir première tâche
    const firstTask = page.locator('a[href^="/dashboard/tasks/"]').first();
    await firstTask.click().catch(async () => {
      // Créer tâche si aucune existe
      await page.click('button:has-text("Nouvelle tâche")');
      await page.fill('[name="title"]', 'Task with Checklist');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);
    });

    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Chercher section checklist
    const checklistSection = page.locator('text=/Checklist|Liste de contrôle/i').first();
    const hasSec tion = await checklistSection.isVisible().catch(() => false);

    if (hasSection) {
      await expect(checklistSection).toBeVisible();

      // Vérifier présence bouton "Ajouter item"
      await expect(page.locator('button:has-text("Ajouter")')).toBeVisible();
    }
  });

  test('should add new checklist item', async ({ page }) => {
    // Ouvrir tâche
    await page.click('a[href^="/dashboard/tasks/"]').first().catch(async () => {
      await page.click('button:has-text("Nouvelle tâche")');
      await page.fill('[name="title"]', 'Task for Checklist Add Test');
      await page.click('button[type="submit"]');
    });

    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Cliquer "Ajouter item" ou "Add checklist item"
    await page.click('button:has-text("Ajouter")').catch(() => {
      page.click('button:has-text("Add item")');
    });

    // Remplir texte nouvel item
    const newItemText = `E2E Test Item ${Date.now()}`;
    const inputSelector = '[data-testid="new-checklist-item-input"], input[placeholder*="item"]';

    await page.fill(inputSelector, newItemText).catch(async () => {
      // Si input apparaît dynamiquement
      await page.waitForSelector('input[type="text"]').then(() => {
        page.fill('input[type="text"]', newItemText);
      });
    });

    // Soumettre (Enter ou bouton)
    await page.press(inputSelector, 'Enter').catch(() => {
      page.click('button:has-text("Ajouter")');
    });

    // Vérifier item ajouté visible
    await expect(page.locator(`text=${newItemText}`)).toBeVisible({ timeout: 5000 });

    // Reload page et vérifier persistance
    await page.reload();
    await expect(page.locator(`text=${newItemText}`)).toBeVisible({ timeout: 5000 });
  });

  test('should toggle checklist item (check/uncheck)', async ({ page }) => {
    // Ouvrir tâche avec checklist
    await page.click('a[href^="/dashboard/tasks/"]').first().catch(async () => {
      await page.click('button:has-text("Nouvelle tâche")');
      await page.fill('[name="title"]', 'Task for Toggle Test');
      await page.click('button[type="submit"]');
    });

    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Ajouter un item si checklist vide
    const checkbox = page.locator('input[type="checkbox"]').first();
    const checkboxExists = await checkbox.isVisible().catch(() => false);

    if (!checkboxExists) {
      // Ajouter item
      await page.click('button:has-text("Ajouter")');
      await page.fill('input[type="text"]', 'Item to toggle');
      await page.press('input[type="text"]', 'Enter');
      await page.waitForTimeout(1000);
    }

    // Trouver première checkbox
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();

    // Récupérer état initial
    const wasChecked = await firstCheckbox.isChecked();

    // Toggle (cliquer)
    await firstCheckbox.click();

    // Attendre API save (si debounced)
    await page.waitForTimeout(1500);

    // Vérifier état inversé
    const nowChecked = await firstCheckbox.isChecked();
    expect(nowChecked).toBe(!wasChecked);

    // Reload et vérifier persistance
    await page.reload();
    await page.waitForLoadState('networkidle');

    const afterReloadChecked = await page.locator('input[type="checkbox"]').first().isChecked();
    expect(afterReloadChecked).toBe(!wasChecked);
  });

  test('should delete checklist item', async ({ page }) => {
    // Ouvrir tâche
    await page.click('a[href^="/dashboard/tasks/"]').first().catch(async () => {
      await page.click('button:has-text("Nouvelle tâche")');
      await page.fill('[name="title"]', 'Task for Delete Test');
      await page.click('button[type="submit"]');
    });

    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Ajouter item à supprimer
    const itemToDelete = `Item to delete ${Date.now()}`;
    await page.click('button:has-text("Ajouter")');
    await page.fill('input[type="text"]', itemToDelete);
    await page.press('input[type="text"]', 'Enter');
    await page.waitForTimeout(1000);

    // Vérifier item existe
    await expect(page.locator(`text=${itemToDelete}`)).toBeVisible();

    // Compter items avant suppression
    const itemsBefore = await page.locator('input[type="checkbox"]').count();

    // Cliquer bouton delete (icône poubelle ou X)
    await page.click(`text=${itemToDelete} >> .. >> button`).catch(() => {
      // Essayer sélecteur alternatif
      page.locator(`text=${itemToDelete}`).locator('..').locator('button[data-action="delete"], button:has-text("×")').click();
    });

    // Attendre disparition
    await expect(page.locator(`text=${itemToDelete}`)).not.toBeVisible({ timeout: 5000 });

    // Vérifier count diminué
    const itemsAfter = await page.locator('input[type="checkbox"]').count();
    expect(itemsAfter).toBe(itemsBefore - 1);
  });

  test('should display empty state if no checklist items', async ({ page }) => {
    // Créer nouvelle tâche (pas de checklist par défaut)
    await page.click('button:has-text("Nouvelle tâche")');
    await page.waitForSelector('form, [role="dialog"]');

    await page.fill('[name="title"]', 'Task Empty Checklist');
    await page.fill('[name="description"]', 'No checklist items');

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Vérifier section checklist vide ou message "Aucun item"
    const emptyMessage = page.locator('text=/Aucun.*item|No items|Empty checklist/i');
    const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);

    if (hasEmptyMessage) {
      await expect(emptyMessage).toBeVisible();
    }

    // Ou au moins bouton "Ajouter" visible
    await expect(page.locator('button:has-text("Ajouter")')).toBeVisible();
  });

  test('should show checklist progress if implemented', async ({ page }) => {
    // Ouvrir tâche avec checklist
    await page.click('a[href^="/dashboard/tasks/"]').first().catch(async () => {
      await page.click('button:has-text("Nouvelle tâche")');
      await page.fill('[name="title"]', 'Task with Progress');
      await page.click('button[type="submit"]');
    });

    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Chercher indicateur de progression (ex: "2/5 items completed")
    const progressIndicator = page.locator('text=/\\d+\\/\\d+|\\d+%/').first();
    const hasProgress = await progressIndicator.isVisible().catch(() => false);

    if (hasProgress) {
      // Si progression affichée, vérifier format correct
      const progressText = await progressIndicator.textContent();
      expect(progressText).toMatch(/\d+/); // Au moins un chiffre
    }
  });

  test('should handle multiple checklist items', async ({ page }) => {
    // Créer tâche avec plusieurs items
    await page.click('button:has-text("Nouvelle tâche")');
    await page.fill('[name="title"]', 'Task Multi Checklist');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard\/tasks\/[a-z0-9-]+$/);

    // Ajouter 3 items
    for (let i = 1; i <= 3; i++) {
      await page.click('button:has-text("Ajouter")');
      await page.fill('input[type="text"]', `Item ${i}`);
      await page.press('input[type="text"]', 'Enter');
      await page.waitForTimeout(500);
    }

    // Vérifier 3 checkboxes visibles
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(3, { timeout: 5000 });

    // Cocher premier et troisième
    await checkboxes.nth(0).click();
    await page.waitForTimeout(500);
    await checkboxes.nth(2).click();
    await page.waitForTimeout(1500);

    // Reload et vérifier états préservés
    await page.reload();
    await page.waitForLoadState('networkidle');

    const checkbox0 = page.locator('input[type="checkbox"]').nth(0);
    const checkbox1 = page.locator('input[type="checkbox"]').nth(1);
    const checkbox2 = page.locator('input[type="checkbox"]').nth(2);

    await expect(checkbox0).toBeChecked();
    await expect(checkbox1).not.toBeChecked();
    await expect(checkbox2).toBeChecked();
  });
});
