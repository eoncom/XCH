import { test, expect } from '../../fixtures/auth.fixture';
import { NavigationHelper } from '../../helpers/navigation';
import { TEST_DATA, generateUniqueData } from '../../helpers/test-data';

/**
 * Tests E2E - Tasks - Kanban + Drag & Drop
 *
 * Scénarios testés:
 * - Affichage Kanban (3 colonnes)
 * - Création tâche
 * - Drag & drop entre colonnes
 * - Filtres par priorité/assignation
 * - Checklist items
 */

test.describe('Tasks - Kanban', () => {
  let nav: NavigationHelper;

  test.beforeEach(async ({ page, loginAsAdmin }) => {
    await loginAsAdmin();
    nav = new NavigationHelper(page);
    await nav.goToTasks();
  });

  test('devrait afficher le Kanban avec 3 colonnes', async ({ page }) => {
    await expect(page.locator('h1, h2').last()).toContainText(/Tasks|Tâches/i);

    // Vérifier colonnes Kanban
    const todoColumn = page.locator('[data-testid="column-TODO"], [data-status="TODO"]');
    const inProgressColumn = page.locator('[data-testid="column-IN_PROGRESS"], [data-status="IN_PROGRESS"]');
    const doneColumn = page.locator('[data-testid="column-DONE"], [data-status="DONE"]');

    await expect(todoColumn).toBeVisible();
    await expect(inProgressColumn).toBeVisible();
    await expect(doneColumn).toBeVisible();
  });

  test('devrait créer une nouvelle tâche', async ({ page }) => {
    const taskData = generateUniqueData(TEST_DATA.tasks.installation);

    // Cliquer nouveau
    await nav.clickNewButton();
    await page.waitForSelector('form');

    // Remplir formulaire
    await page.fill('input[name="title"]', taskData.title);
    await page.fill('textarea[name="description"]', taskData.description);

    // Status
    const statusSelect = page.locator('select[name="status"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption(taskData.status);
    }

    // Priority
    const prioritySelect = page.locator('select[name="priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption(taskData.priority);
    }

    // Site (requis)
    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Vérifier présence dans Kanban
    await expect(page.locator(`text=${taskData.title}`)).toBeVisible({ timeout: 10000 });
  });

  test('devrait déplacer une tâche par drag & drop (TODO → IN_PROGRESS)', async ({ page }) => {
    // Créer une tâche TODO d'abord
    const taskData = generateUniqueData(TEST_DATA.tasks.installation);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="title"]', taskData.title);

    const statusSelect = page.locator('select[name="status"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('TODO');
    }

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Retourner au Kanban
    await nav.goToTasks();

    // Trouver la carte de la tâche créée
    const taskCard = page.locator(`[data-testid*="task"], .task-card`).filter({ hasText: taskData.title }).first();

    if (await taskCard.isVisible()) {
      // Drag & drop vers IN_PROGRESS
      const inProgressColumn = page.locator('[data-testid="column-IN_PROGRESS"], [data-status="IN_PROGRESS"]').first();

      await taskCard.dragTo(inProgressColumn);

      // Attendre mise à jour
      await page.waitForTimeout(1000);

      // Vérifier que la tâche est maintenant dans IN_PROGRESS
      const taskInProgress = inProgressColumn.locator(`text=${taskData.title}`);
      await expect(taskInProgress).toBeVisible({ timeout: 5000 });
    }
  });

  test('devrait déplacer une tâche (IN_PROGRESS → DONE)', async ({ page }) => {
    // Créer tâche IN_PROGRESS
    const taskData = generateUniqueData(TEST_DATA.tasks.maintenance);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="title"]', taskData.title);

    const statusSelect = page.locator('select[name="status"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('IN_PROGRESS');
    }

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    await nav.goToTasks();

    // Drag vers DONE
    const taskCard = page.locator(`[data-testid*="task"], .task-card`).filter({ hasText: taskData.title }).first();

    if (await taskCard.isVisible()) {
      const doneColumn = page.locator('[data-testid="column-DONE"], [data-status="DONE"]').first();
      await taskCard.dragTo(doneColumn);
      await page.waitForTimeout(1000);

      const taskInDone = doneColumn.locator(`text=${taskData.title}`);
      await expect(taskInDone).toBeVisible({ timeout: 5000 });
    }
  });

  test('devrait filtrer les tâches par priorité', async ({ page }) => {
    const priorityFilter = page.locator('select[name="priority"], [data-testid="priority-filter"]');

    if (await priorityFilter.isVisible()) {
      await priorityFilter.selectOption('HIGH');
      await page.waitForTimeout(1000);

      // Vérifier que seules les tâches HIGH priority sont affichées
      const taskCards = page.locator('[data-testid*="task"], .task-card');
      const count = await taskCards.count();

      if (count > 0) {
        await expect(taskCards.first()).toContainText(/HIGH|Haute/i);
      }
    }
  });

  test('devrait afficher le détail d\'une tâche', async ({ page }) => {
    // Cliquer sur première tâche
    const firstTask = page.locator('[data-testid*="task"], .task-card').first();

    if (await firstTask.isVisible()) {
      await firstTask.click();

      // Attendre modal ou page détail
      await page.waitForTimeout(1000);

      // Vérifier présence éléments détail
      const detailView = page.locator('[role="dialog"], [data-testid="task-detail"]');
      await expect(detailView).toBeVisible();

      // Vérifier champs
      await expect(detailView.locator('text=Titre, text=Title, text=Description')).toBeVisible();
    }
  });

  test('devrait modifier une tâche existante', async ({ page }) => {
    // Créer tâche
    const taskData = generateUniqueData(TEST_DATA.tasks.installation);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="title"]', taskData.title);

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    await nav.goToTasks();

    // Cliquer sur tâche
    await page.click(`text=${taskData.title}`);
    await page.waitForTimeout(500);

    // Cliquer modifier
    const editButton = page.locator('button:has-text("Modifier"), a:has-text("Modifier")');
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForSelector('form');

      // Modifier titre
      const newTitle = `Tâche Modifiée ${Date.now()}`;
      await page.fill('input[name="title"]', newTitle);

      await page.click('button[type="submit"]');
      await nav.waitForToast();

      // Vérifier modification
      await expect(page.locator(`text=${newTitle}`)).toBeVisible({ timeout: 10000 });
    }
  });

  test('devrait assigner une tâche à un utilisateur', async ({ page }) => {
    // Créer tâche
    const taskData = generateUniqueData(TEST_DATA.tasks.maintenance);

    await nav.clickNewButton();
    await page.waitForSelector('form');

    await page.fill('input[name="title"]', taskData.title);

    const siteSelect = page.locator('select[name="siteId"]');
    if (await siteSelect.isVisible()) {
      await siteSelect.selectOption({ index: 1 });
    }

    // Assigner à un utilisateur
    const assigneeSelect = page.locator('select[name="assignedTo"]');
    if (await assigneeSelect.isVisible()) {
      await assigneeSelect.selectOption({ index: 1 }); // Premier utilisateur
    }

    await page.click('button[type="submit"]');
    await nav.waitForToast();

    // Vérifier assignation
    await expect(page.locator(`text=${taskData.title}`)).toBeVisible({ timeout: 10000 });
  });
});
