import { test as base, Page } from '@playwright/test';

/**
 * Fixture d'authentification pour tests E2E
 *
 * Fournit des méthodes pour login/logout et gestion de session
 */

export interface AuthUser {
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIEN' | 'VIEWER';
  token?: string;
}

// Utilisateurs de test (doivent exister en DB ou être seedés)
export const TEST_USERS = {
  admin: {
    email: 'admin@xch.local',
    password: 'Admin123!',
    role: 'ADMIN' as const,
  },
  manager: {
    email: 'manager@xch.local',
    password: 'Manager123!',
    role: 'MANAGER' as const,
  },
  technicien: {
    email: 'tech@xch.local',
    password: 'Tech123!',
    role: 'TECHNICIEN' as const,
  },
  viewer: {
    email: 'viewer@xch.local',
    password: 'Viewer123!',
    role: 'VIEWER' as const,
  },
};

interface AuthFixture {
  loginAsAdmin: () => Promise<void>;
  loginAsManager: () => Promise<void>;
  loginAsTechnicien: () => Promise<void>;
  loginAsViewer: () => Promise<void>;
  loginAs: (user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: () => Promise<boolean>;
}

export const test = base.extend<AuthFixture>({
  // Fixture pour login en tant qu'admin
  loginAsAdmin: async ({ page }, use) => {
    await use(async () => {
      await login(page, TEST_USERS.admin);
    });
  },

  // Fixture pour login en tant que manager
  loginAsManager: async ({ page }, use) => {
    await use(async () => {
      await login(page, TEST_USERS.manager);
    });
  },

  // Fixture pour login en tant que technicien
  loginAsTechnicien: async ({ page }, use) => {
    await use(async () => {
      await login(page, TEST_USERS.technicien);
    });
  },

  // Fixture pour login en tant que viewer
  loginAsViewer: async ({ page }, use) => {
    await use(async () => {
      await login(page, TEST_USERS.viewer);
    });
  },

  // Fixture pour login personnalisé
  loginAs: async ({ page }, use) => {
    await use(async (user: AuthUser) => {
      await login(page, user);
    });
  },

  // Fixture pour logout
  logout: async ({ page }, use) => {
    await use(async () => {
      await logout(page);
    });
  },

  // Fixture pour vérifier authentification
  isAuthenticated: async ({ page }, use) => {
    await use(async () => {
      return await isAuthenticated(page);
    });
  },
});

/**
 * Fonction helper pour login
 */
async function login(page: Page, user: AuthUser): Promise<void> {
  // Naviguer vers page login
  await page.goto('/login');

  // Attendre que le formulaire soit visible
  await page.waitForSelector('form');

  // Remplir le formulaire
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);

  // Soumettre
  await page.click('button[type="submit"]');

  // Attendre redirection vers dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Vérifier que le token est stocké en localStorage
  const token = await page.evaluate(() => localStorage.getItem('xch_token'));
  if (!token) {
    throw new Error('Login failed: No token stored');
  }
}

/**
 * Fonction helper pour logout
 */
async function logout(page: Page): Promise<void> {
  // Vérifier qu'on est authentifié
  if (!(await isAuthenticated(page))) {
    return;
  }

  // Aller au dashboard pour avoir accès au menu
  await page.goto('/dashboard');

  // Ouvrir le menu utilisateur
  await page.click('[data-testid="user-menu"]');

  // Cliquer sur logout
  await page.click('[data-testid="logout-button"]');

  // Attendre redirection vers login
  await page.waitForURL('/login', { timeout: 5000 });

  // Vérifier que le token est supprimé
  const token = await page.evaluate(() => localStorage.getItem('xch_token'));
  if (token) {
    throw new Error('Logout failed: Token still stored');
  }
}

/**
 * Fonction helper pour vérifier authentification
 */
async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('xch_token'));
  return !!token;
}

export { expect } from '@playwright/test';
