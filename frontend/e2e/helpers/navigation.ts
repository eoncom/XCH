import { Page } from '@playwright/test';

/**
 * Helpers de navigation pour tests E2E
 *
 * Fonctions réutilisables pour naviguer dans l'application
 */

export class NavigationHelper {
  constructor(private page: Page) {}

  // Navigation principales
  async goToDashboard() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async goToSites() {
    await this.page.goto('/dashboard/sites');
    await this.page.waitForLoadState('networkidle');
  }

  async goToAssets() {
    await this.page.goto('/dashboard/assets');
    await this.page.waitForLoadState('networkidle');
  }

  async goToTasks() {
    await this.page.goto('/dashboard/tasks');
    await this.page.waitForLoadState('networkidle');
  }

  async goToRacks() {
    await this.page.goto('/dashboard/racks');
    await this.page.waitForLoadState('networkidle');
  }

  async goToFloorPlans() {
    await this.page.goto('/dashboard/floor-plans');
    await this.page.waitForLoadState('networkidle');
  }

  async goToUsers() {
    await this.page.goto('/dashboard/users');
    await this.page.waitForLoadState('networkidle');
  }

  async goToSettings() {
    await this.page.goto('/dashboard/settings');
    await this.page.waitForLoadState('networkidle');
  }

  // Navigation via sidebar
  async clickSidebarLink(text: string) {
    await this.page.click(`nav a:has-text("${text}")`);
    await this.page.waitForLoadState('networkidle');
  }

  // Actions communes
  async clickNewButton() {
    // Chercher le bouton avec icône Plus ou texte contenant "Nouv"
    await this.page.click('a:has-text("Nouv"), button:has-text("Nouv"), a:has-text("Créer"), button:has-text("Créer")');
  }

  async clickBackButton() {
    await this.page.click('button:has-text("Retour"), a:has-text("Retour")');
  }

  async search(query: string) {
    await this.page.fill('input[type="search"], input[placeholder*="Recherche"], input[placeholder*="Search"]', query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async waitForToast(message?: string) {
    if (message) {
      await this.page.waitForSelector(`[role="alert"]:has-text("${message}")`, { timeout: 5000 });
    } else {
      await this.page.waitForSelector('[role="alert"]', { timeout: 5000 });
    }
  }

  async closeToast() {
    const toastClose = this.page.locator('[role="alert"] button');
    if (await toastClose.isVisible()) {
      await toastClose.click();
    }
  }
}
