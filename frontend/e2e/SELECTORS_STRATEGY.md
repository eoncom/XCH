# Stratégie sélecteurs E2E — XCH

**Date :** 2026-05-02 (Session 7.5)
**Validée par :** utilisateur (Option hybride)

## Principe

Pour les specs Playwright sous `frontend/e2e/tests/`, deux stratégies coexistent. Ne pas dériver vers α systématique sans validation explicite.

## Zones α — `data-testid` (durables, indépendantes de la copie FR)

Les éléments listés ci-dessous DOIVENT porter un `data-testid` stable. Ils correspondent aux primitives critiques zéro-testid identifiées en S7.5 (login sans testid ni `name=`, sidebar nav avec `name` libellé FR uniquement, delegation switch sans hook E2E).

### Login form (`frontend/src/app/login/page.tsx`)

| Élément              | testid              | Rôle |
|----------------------|---------------------|------|
| `<form>` racine      | `login-form`        | Garde-fou page identifiée |
| Input email          | `login-email`       | Sélecteur email indépendant de `id="email"` |
| Input password       | `login-password`    | Sélecteur password indépendant de `id="password"` |
| Bouton submit        | `login-submit`      | Bouton "Se connecter" indépendant du texte FR |

### Sidebar nav (`frontend/src/app/dashboard/layout.tsx`)

Pattern : `nav-{slug}` calculé depuis `item.href`. Les 11 entrées du `navigation` array + 3 du `adminNavigation` reçoivent un testid déterministe.

| Entrée              | testid                |
|---------------------|----------------------|
| Dashboard           | `nav-dashboard`      |
| Sites               | `nav-sites`          |
| Équipements         | `nav-assets`         |
| Baies               | `nav-racks`          |
| Tâches              | `nav-tasks`          |
| Plans               | `nav-floor-plans`    |
| Contacts            | `nav-contacts`       |
| Monitoring          | `nav-monitoring`     |
| NetBox              | `nav-netbox`         |
| Dashboard TV        | `nav-tv`             |
| Alertes             | `nav-alerts`         |
| Notifications       | `nav-notifications`  |
| Consommation        | `nav-consumption`    |
| Utilisateurs (admin)| `nav-users`          |
| Coûts (admin)       | `nav-costs`          |
| Audit (admin)       | `nav-audit`          |
| Paramètres          | `nav-settings`       |

### Delegation switch (`frontend/src/app/dashboard/settings/my-delegation-tab.tsx`)

| Élément                                | testid                                |
|----------------------------------------|---------------------------------------|
| Card "Mes délégations"                 | `delegation-switcher-card`            |
| Bouton délégation (par option)         | `delegation-option-{code}`            |
| Bouton délégation active (variant `default`) | `delegation-current` + option testid |

Le helper `switchActiveDelegationViaUI` (`frontend/e2e/fixtures/delegation.fixture.ts`) cliquera `[data-testid="delegation-option-${code}"]`.

## Zones β — sélecteurs génériques (toutes autres specs)

Pour le reste : `getByRole`, `getByLabel`, `getByText`, `input[name="..."]`, URL navigation. Le texte FR de l'app est stable (vérifié 2026-05-02), donc fiable comme sélecteur secondaire.

- **Forms react-hook-form** : `register("fieldName")` pose automatiquement `name="fieldName"` sur l'input. Le sélecteur `input[name="fieldName"]` fonctionne sans testid.
- **Tables** : `getByRole("row")`, `getByRole("cell")`, ou texte ligne.
- **Boutons** : `getByRole("button", { name: "Texte FR exact" })`.
- **Liens nav** : `getByRole("link", { name: "..." })` ou URL `page.goto('/dashboard/...')`.
- **Konva canvas** : helpers `frontend/e2e/helpers/konva.ts` (boundingBox + relX/relY).

## Quand peut-on étendre la zone α ?

Élargir UNIQUEMENT si l'utilisateur valide explicitement une nouvelle zone. Critères pour proposer :

- 3+ specs dépendent du même élément non-stable
- Le texte FR évolue ou est source d'ambiguïté (libellés répétés, A11y mauvaise)
- Le sélecteur générique nécessite des contournements répétés (regex, `:nth-of-type`, `closest`)

Exemple à ne PAS faire : ajouter `data-testid` sur chaque ligne d'une table juste parce qu'une spec teste cette table — `getByRole("row")` + texte cellule suffit.

## Référence MCP

- `XCH_E2E_SCAFFOLDING_VS_VALIDATION` : scaffolding ≠ testing, validation visuelle obligatoire avant tag
- `XCH_E2E_SMOKE_AUTHORITY_VALIDATION` : pattern filet CI (activé + exécuté + endpoints réels)
- `XCH_E2E_SKIP_TODO_TRACKING` : registre catégorisé skip restants
