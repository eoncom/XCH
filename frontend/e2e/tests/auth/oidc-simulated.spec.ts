import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Tests E2E - OIDC simulated callback flow (S7 PR1).
 *
 * Couvre la cible critical path "login (auth hybride local + OIDC)"
 * du plan S7, partie OIDC. Valide :
 * - callback OIDC mock (POST /api/auth/oidc/callback avec code factice)
 * - mapping claims OIDC → User backend (email + name + group → role)
 * - first-time provisioning (création User si inexistant)
 * - refresh token flow OIDC vs local
 *
 * Fixtures : `auth.fixture.ts` (login local existing) + nouveau
 * helper OIDC à compléter.
 *
 * Note SCAFFOLDING : ces tests sont en `test.skip` jusqu'à ce que
 * (1) PR0 mergée (fixture auth stable), (2) endpoint mock OIDC
 * disponible côté backend (variable env `OIDC_MOCK_ENABLED=true` à
 * ajouter en S7 PR1+ ou en spec environment setup), (3) helper
 * `loginViaOidc()` ajouté à auth.fixture.ts.
 *
 * Plan PR1 : poser le squelette + identifier les blocages côté backend
 * (faut-il une route mock OIDC dédiée tests E2E ?). Décision posée
 * dans PR1 review.
 */

const API_URL = () => process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002';

test.describe('OIDC simulated login', () => {
  test.skip('callback OIDC avec code valide redirige vers /dashboard', async ({ page }) => {
    // SCAFFOLDING — à compléter quand backend expose un endpoint mock
    // (ex: POST /api/auth/oidc/mock-callback) ou quand on simule un
    // provider OIDC local avec wiremock dans docker-compose.e2e.yml.
    //
    // Plan : POST /api/auth/oidc/callback avec body { code: 'mock-code-123', state: '...' },
    // attendre Set-Cookie accessToken, page.goto('/dashboard') doit
    // marcher.
    await page.goto('/login');
    expect(true).toBe(true); // placeholder
  });

  test.skip('first-time OIDC provisioning crée un User backend', async ({ page, request }) => {
    // SCAFFOLDING — claim email OIDC inexistant en DB → User créé
    // automatiquement avec role par défaut + UserDelegation seedée
    // selon mapping group → delegation (settings tenant.config.sso).
    //
    // Plan : POST mock callback avec email 'newuser@oidc.local', vérifier
    // qu'un GET /api/users (admin) retourne ce user après le call.
    expect(true).toBe(true); // placeholder
  });

  test.skip('mapping claims OIDC → user.role respecte settings tenant', async ({ page }) => {
    // SCAFFOLDING — le tenant a une config SSO avec mapping group
    // → role (cf TenantSsoConfig.groupToRole). Tester que l'utilisateur
    // OIDC reçoit le role attendu selon ses groupes claim.
    expect(true).toBe(true); // placeholder
  });

  test.skip('refresh token OIDC fonctionne comme refresh local', async ({ page, request }) => {
    // SCAFFOLDING — après login OIDC, le cookie refreshToken doit être
    // valide pour POST /api/auth/refresh. Vérifier qu'un new accessToken
    // est émis.
    expect(true).toBe(true); // placeholder
  });

  test('login local et OIDC coexistent sans conflit (smoke)', async ({ page, loginAsAdmin }) => {
    // Test simple : login local marche normalement (la cohabitation
    // OIDC + local est gérée côté backend par auth.controller).
    // Quand OIDC sera mocké, ajouter ici un cas mixte (login local
    // user1, logout, login OIDC user2, vérifier session séparée).
    await loginAsAdmin();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'accessToken');
    expect(accessToken).toBeTruthy();
  });
});
