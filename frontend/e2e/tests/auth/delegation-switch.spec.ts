import { test, expect } from '../../fixtures/delegation.fixture';
import {
  getDelegationIdByCode,
  switchActiveDelegationViaUI,
} from '../../fixtures/delegation.fixture';

/**
 * Tests E2E - Switch de délégation active (S7 PR1).
 *
 * Couvre la cible critical path "switch délégation (X-Delegation-Id
 * header)" du plan S7. Valide :
 * - changement de délégation via UI Settings → Ma délégation
 * - persistance localStorage `xch-active-delegation`
 * - injection du header `X-Delegation-Id` sur les requêtes suivantes
 * - badge UI reflète la délégation active
 * - permissions effectives recalculées (boutons CUD apparaissent/disparaissent)
 * - revert switch
 *
 * Fixtures : `delegation.fixture.ts` + `setDelegation()` helper.
 *
 * Note PR0/PR1 : cette spec dépend de la fixture auth corrigée par
 * PR0 (Promise.all + waitForResponse). Si exécutée sur main avant
 * merge PR0, peut souffrir du Known Issue SSR/CSR cookies (timeout
 * waitForURL). Documenté.
 */

const STORAGE_KEY = 'xch-active-delegation';

test.describe('Switch délégation', () => {
  test('admin peut récupérer la liste de ses délégations via API', async ({
    page,
    loginAsAdmin,
  }) => {
    await loginAsAdmin();

    // L'admin du seed démo a accès aux 3 délégations (IDF-OUEST, LYON-METROPOLE, MARSEILLE)
    const idf = await getDelegationIdByCode(page, 'IDF-OUEST');
    expect(idf).toBeTruthy();
    expect(idf.length).toBeGreaterThan(10); // cuid format
  });

  test('localStorage `xch-active-delegation` est posé après login', async ({
    page,
    loginAsAdmin,
  }) => {
    await loginAsAdmin();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeTruthy();
  });

  test.skip('switch via UI met à jour le header X-Delegation-Id sur les requêtes suivantes', async ({
    page,
    loginAsAdmin,
  }) => {
    // SCAFFOLDING — à compléter après merge PR0 + récupération du
    // sélecteur exact dans my-delegation-tab.tsx (boutons rôles).
    //
    // Plan : intercepter les requêtes API via page.route() pour
    // capturer le header X-Delegation-Id avant et après le switch,
    // confirmer changement, vérifier qu'aucune requête legacy ne
    // garde l'ancien.
    await loginAsAdmin();

    const lyonId = await getDelegationIdByCode(page, 'LYON-METROPOLE');
    await switchActiveDelegationViaUI(page, 'LYON-METROPOLE');

    // TODO : capturer une requête API et asserter X-Delegation-Id == lyonId
    expect(lyonId).toBeTruthy();
  });

  test.skip('UI badge reflète la délégation active après switch', async ({
    page,
    loginAsAdmin,
  }) => {
    // SCAFFOLDING — à compléter quand badge selector connu (header
    // dashboard layout, probablement DelegationContext consumer).
    await loginAsAdmin();
    await switchActiveDelegationViaUI(page, 'LYON-METROPOLE');

    // TODO : trouver le badge délégation dans le header layout et
    // asserter son texte = 'Lyon Métropole'.
    expect(true).toBe(true);
  });

  test.skip('permissions effectives recalculées après switch', async ({
    page,
    loginAs,
    loginAsManager,
  }) => {
    // SCAFFOLDING — manager a des rôles DIFFÉRENTS selon délégation
    // (admin sur IDF, viewer sur LYON par exemple). Le switch doit
    // changer la visibilité des boutons CUD.
    //
    // Plan : login manager, vérifier bouton "Nouveau site" non visible
    // sur LYON, switch vers IDF où il a MANAGE, vérifier bouton
    // apparaît.
    await loginAsManager();

    // TODO : préparer seed avec UserDelegation différents par scope
    // pour tester réellement le recalcul.
    expect(true).toBe(true);
  });

  test.skip('revert switch restaure la délégation initiale', async ({
    page,
    loginAsAdmin,
  }) => {
    // SCAFFOLDING — plan : capturer la délégation initiale (depuis
    // localStorage), switcher vers une autre, switcher back, vérifier
    // localStorage restauré + header API restauré.
    await loginAsAdmin();
    expect(true).toBe(true);
  });
});
