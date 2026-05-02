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

// S7 PR5c/5 — Utilisateurs de test alignés sur le SEED DÉMO RÉEL
// (cf backend/src/modules/seed/seed.service.ts createUsers ligne 470+).
// Bug historique : les anciens emails @xch.demo + passwords admin123/
// manager123/tech1234/invit123 ne correspondaient à AUCUN user en DB.
// Le seed démo crée @demo.fr avec passwords demo123 (pour les non-admin)
// et l'admin reçoit son password depuis /setup/initialize (Demo1234
// par convention, cf project_prod_access mémoire).
export const TEST_USERS = {
  admin: {
    email: 'admin@demo.fr',
    password: 'Demo1234',
    role: 'ADMIN' as const,
  },
  manager: {
    email: 'manager@demo.fr',
    password: 'demo123',
    role: 'MANAGER' as const,
  },
  technicien: {
    email: 'technicien@demo.fr',
    password: 'demo123',
    role: 'TECHNICIEN' as const,
  },
  viewer: {
    email: 'viewer@demo.fr',
    password: 'demo123',
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
 * Fonction helper pour login.
 *
 * S7 PR0 Option A — résolution Known Issue SSR/CSR cookies E2E :
 * On attend explicitement la réponse 200 du POST /api/auth/login AVANT de
 * waitForURL('/dashboard'). Sans ce wait, le browser cliquait submit puis
 * suivait la redirection client-side avant que le Set-Cookie ait été
 * propagé au context Playwright. Le middleware Next.js voyait alors une
 * requête sans cookie et renvoyait sur /login → timeout sur waitForURL.
 *
 * Le Promise.all garantit que le listener waitForResponse est armé AVANT
 * que le click ne déclenche le POST. Timeout dashboard étendu à 15s pour
 * couvrir le hop SSR → CSR + checkSession() côté Zustand.
 */
async function login(page: Page, user: AuthUser): Promise<void> {
  // S7.5 PR5d — testids α login form (cf SELECTORS_STRATEGY.md zone α #1).
  await page.goto('/login');
  await page.waitForSelector('[data-testid="login-form"]');
  await page.fill('[data-testid="login-email"]', user.email);
  await page.fill('[data-testid="login-password"]', user.password);

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.status() === 200,
      { timeout: 10000 },
    ),
    page.click('[data-testid="login-submit"]'),
  ]);

  await page.waitForURL('/dashboard', { timeout: 15000 });

  const cookies = await page.context().cookies();
  const accessTokenCookie = cookies.find((c) => c.name === 'accessToken');

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
