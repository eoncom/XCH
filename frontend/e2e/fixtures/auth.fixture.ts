import { test as base, Page } from '@playwright/test';

/**
 * Fixture d'authentification pour tests E2E
 *
 * Utilise les cookies HTTP-only (plus de localStorage pour tokens)
 */

export interface AuthUser {
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIEN' | 'VIEWER';
}

// Utilisateurs de test (correspondent aux seed data en production)
export const TEST_USERS = {
  admin: {
    email: 'admin@xch.demo',
    password: 'admin123',
    role: 'ADMIN' as const,
  },
  manager: {
    email: 'manager@xch.demo',
    password: 'manager123',
    role: 'MANAGER' as const,
  },
  technicien: {
    email: 'tech@xch.demo',
    password: 'tech1234',
    role: 'TECHNICIEN' as const,
  },
  viewer: {
    email: 'inviter@xch.demo',
    password: 'invit123',
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
 * ✅ Utilise cookies HTTP-only (automatiques Playwright)
 */
async function login(page: Page, user: AuthUser): Promise<void> {
  // Naviguer vers page login
  await page.goto('/login');

  // Attendre que le formulaire soit visible
  await page.waitForSelector('form');

  // Remplir le formulaire
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);

  // Soumettre
  await page.click('button[type="submit"]');

  // Attendre redirection vers dashboard (backend set cookies automatiquement)
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // ✅ Vérifier que le cookie accessToken existe (HTTP-only)
  const cookies = await page.context().cookies();
  const accessTokenCookie = cookies.find(c => c.name === 'accessToken');

  if (!accessTokenCookie) {
    throw new Error('Login failed: No accessToken cookie set');
  }
}

/**
 * Fonction helper pour logout
 * ✅ Cookies HTTP-only effacés automatiquement par backend
 */
async function logout(page: Page): Promise<void> {
  // Vérifier qu'on est authentifié
  if (!(await isAuthenticated(page))) {
    return;
  }

  // Cliquer directement sur le bouton logout (visible dans dashboard layout)
  await page.click('[data-testid="logout-button"]');

  // Attendre redirection vers login
  await page.waitForURL('/login', { timeout: 5000 });

  // ✅ Vérifier que les cookies sont supprimés
  const cookies = await page.context().cookies();
  const accessTokenCookie = cookies.find(c => c.name === 'accessToken');

  if (accessTokenCookie) {
    throw new Error('Logout failed: accessToken cookie still exists');
  }
}

/**
 * Fonction helper pour vérifier authentification
 * ✅ Vérifie présence cookie accessToken (HTTP-only)
 */
async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  const accessTokenCookie = cookies.find(c => c.name === 'accessToken');
  return !!accessTokenCookie && !!accessTokenCookie.value;
}

export { expect } from '@playwright/test';
