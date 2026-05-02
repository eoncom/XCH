import { test as base, Page, BrowserContext } from '@playwright/test';
import { test as authTest } from './auth.fixture';

/**
 * Fixture délégation pour tests E2E (S7 PR1).
 *
 * XCH applique le modèle delegation-first (ADR-009) : chaque requête
 * tenant-scopée doit porter le header `X-Delegation-Id`. Le frontend
 * lit ce header depuis `localStorage['xch-active-delegation']` via
 * DelegationContext (frontend/src/contexts/DelegationContext.tsx).
 *
 * Pour les specs E2E qui doivent contrôler la délégation active sans
 * passer par le UI Settings → Ma délégation, on injecte la valeur
 * directement en localStorage AVANT que la page ne charge.
 *
 * Pour tester le switch via UI lui-même (clic dans Settings, badge
 * mis à jour, header X-Delegation-Id émis sur les requêtes suivantes),
 * voir `e2e/tests/auth/delegation-switch.spec.ts`.
 */

const STORAGE_KEY = 'xch-active-delegation';
const API_URL = () => process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

/**
 * Pose la délégation active dans le localStorage du navigateur AVANT
 * toute navigation. Doit être appelé AVANT `page.goto()` car le
 * DelegationContext lit le localStorage au mount.
 *
 * Note : si la page est déjà mounted, refresh nécessaire pour que le
 * contexte relise localStorage. Préférer cette fixture en début de
 * test (avant login + goto).
 */
export async function setActiveDelegation(
  context: BrowserContext,
  delegationId: string,
  baseURL: string = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
): Promise<void> {
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: delegationId },
  );
}

/**
 * Switch via UI (clic dans Settings → Ma délégation).
 * À utiliser pour tester le flow user, pas en setup.
 */
export async function switchActiveDelegationViaUI(
  page: Page,
  delegationCode: string,
): Promise<void> {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');
  await page.click(`button:has-text("Ma délégation")`).catch(() => {
    // tab déjà ouverte ou nom différent — ignorer
  });
  await page.click(`button:has-text("${delegationCode}"), [data-delegation-code="${delegationCode}"]`);
  await page.waitForTimeout(500);
}

/**
 * Récupère l'ID d'une délégation par son code (ex: 'IDF-OUEST').
 * Utilise l'API /api/user-delegations/mine de l'utilisateur connecté.
 * Le caller doit être déjà authentifié.
 */
export async function getDelegationIdByCode(
  page: Page,
  code: string,
): Promise<string> {
  const cookies = await page.context().cookies();
  const accessToken = cookies.find((c) => c.name === 'accessToken');
  if (!accessToken) {
    throw new Error('getDelegationIdByCode: not authenticated (no accessToken cookie)');
  }

  const response = await page.request.get(`${API_URL()}/api/user-delegations/mine`, {
    headers: { Cookie: `accessToken=${accessToken.value}` },
  });

  if (!response.ok()) {
    throw new Error(
      `getDelegationIdByCode: HTTP ${response.status()} from /api/user-delegations/mine`,
    );
  }

  const list = (await response.json()) as Array<{
    delegationId: string;
    delegation: { code: string };
  }>;
  const match = list.find((d) => d.delegation.code === code);
  if (!match) {
    throw new Error(
      `getDelegationIdByCode: no delegation with code "${code}" found in user's delegations.`,
    );
  }
  return match.delegationId;
}

interface DelegationFixture {
  setDelegation: (delegationId: string) => Promise<void>;
}

/**
 * Test fixture qui combine auth + delegation helper.
 * Utilise authTest comme base pour avoir loginAs* + nouveau setDelegation.
 */
export const test = authTest.extend<DelegationFixture>({
  setDelegation: async ({ context }, use) => {
    await use(async (delegationId: string) => {
      await setActiveDelegation(context, delegationId);
    });
  },
});

export { expect, TEST_USERS } from './auth.fixture';
