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
  // S7.5 PR5h/5 — court-circuit si déjà authentifié (test.describe.serial
  // partage le browser context → cookie persiste entre tests). Évite
  // rate limit 429 du backend après ~5 logins serial.
  if (await isAuthenticated(page)) {
    await page.goto('/dashboard');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    return;
  }

  // S7.5 PR5h/4 — login API direct (bypass UI form).
  //
  // Cause racine du timeout récurrent en CI (run 25260981957 + 2 retries) :
  // `page.fill()` sur un Input contrôlé React 18 production build met le
  // DOM value mais React state n'est pas appliqué avant le click submit
  // (batching / concurrent mode). handleSubmit lit `email`/`password`
  // vides depuis useState → POST /api/auth/login JAMAIS envoyé →
  // waitForResponse timeout. Reproductible via Chrome MCP en local :
  // `form.dispatchEvent(submitEvent)` après reset state n'envoyait pas
  // de requête, alors que setter natif + 'input' event + dispatch
  // submit le faisait.
  //
  // La login UI elle-même est testée par `auth/login.spec.ts` (10 tests
  // dédiés) avec ses propres specs. Le smoke @full-user-journey n'a
  // pas besoin de re-tester la submission form, juste l'authentification.
  // Solution : POST /api/auth/login direct via page.request, le
  // Set-Cookie est propagé automatiquement au browser context (cf
  // Playwright docs : "request fixtures share storage state with the
  // BrowserContext"). Économie 2-3s par test (pas de form submission +
  // SSR/CSR hop).
  const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';
  const response = await page.request.post(`${apiUrl}/api/auth/login`, {
    data: { email: user.email, password: user.password },
  });

  if (!response.ok()) {
    throw new Error(
      `Login API failed: HTTP ${response.status()} for user ${user.email}`,
    );
  }

  // Vérifier que le cookie est bien posé dans le browser context
  const cookies = await page.context().cookies();
  const accessTokenCookie = cookies.find((c) => c.name === 'accessToken');

  if (!accessTokenCookie) {
    throw new Error('Login failed: No accessToken cookie set in browser context');
  }

  // Naviguer vers /dashboard pour cohérence avec l'ancien comportement
  // UI login (qui faisait window.location.href = '/dashboard' post-success).
  await page.goto('/dashboard');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
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
