# Phase 6 — Audit frontend complet v1.4.x

**Date :** 2026-04-19
**Auteur :** Claude Opus 4.7 (1M context) — worktree `mystifying-yalow-ebe6ab`
**Outils :** Grep, Glob, Read (backend + frontend) · 6 agents Explore en parallèle pour T2-T9
**Périmètre :** `frontend/src/` — 53 pages, 45 composants, ~48 700 LoC
**Version testée :** v1.4.0 + correctifs phase 5 (commits `c7400b0..3c58480`)

---

## Résumé exécutif

- **Règles vérifiées :** T1-T9 (contract, formulaires, cascades, permissions UI, states, routing, labels, React Query, a11y)
- **Violations critiques 🔴 :** **10** — 3 formulaires qui submit en 400, 3 failles permissions UI (boutons visibles → 403 back), 1 cascade cassée (Contact type pas filtré), 1 mapping SSO obsolète, 1 sidebar expose une page super-admin aux MANAGE (Journal d'audit), 1 Expense front laisse soumettre sans délégation (UX — le schema back est correct)
- **Violations majeures 🟡 :** **8** — 1 champ manquant Budget, 4 labels/UX incohérents, 1 label `UNDER_MAINTENANCE` absent du helper, 1 explainer verbeux consumption, 1 aller-retour verbeux Inbox ↔ Config notifications
- **A11y prioritaires :** **5** cas (aria-label icon-only buttons, labels non associés)
- **Cosmétiques 🟢 :** typing `as any` excessif, staleTime défaut court, queryKeys divergents, mutations sans `onError` toast (≤ 10 mutations)
- **Pre-audit finding (déjà corrigé) :** `_count.userDelegations` absent de `findOneDelegation` → « Membres : 0 » sur settings/ma-délégation. Fix en commit `3c58480`.
- **Verdict global :** 🟠 **À CORRIGER AVANT DÉMO PILOTE** — les 9 critiques sont tous à impact user direct. Les majeurs et a11y peuvent glisser d'un sprint si besoin.

---

## T1 — Contract front ↔ back

**Méthode :** Grep `_count?.`, `(as any)?.`, `?? 0`, `?? []` dans `frontend/src` (27 occurrences, 16 fichiers) + Read ciblé des backend services correspondants.

### Résultats

| Champ front | Backend renvoie ? | Verdict |
|---|---|---|
| `delegation._count.userDelegations` (my-delegation-tab) | ❌ absent de `findOneDelegation` | 🔴 **déjà corrigé** commit `3c58480` |
| `delegation._count.sites` (my-delegation + organization-tab) | ✅ dans `findAllDelegations` et `findOneDelegation` (post-fix) | OK |
| `model._count.assets` (settings AssetModel table) | ✅ dans `asset-models.service.findAll/findOne` | OK |
| `version._count.pins` (floor-plans/[id]) | ✅ dans `getVersionHistory` | OK |
| `asset.tasks` (assets/[id]) | ✅ dans `assets.service.findOne` include tasks | OK |
| `user.userDelegations` (users list) | ✅ dans `users.service.findAll` | OK |
| `user.userDelegations` (users/[id]/edit) | Fetch via `userDelegationsApi.getByUser(userId)` séparé | OK |
| `user.isSuperAdmin` | ✅ scalaire Prisma, présent par défaut | OK (cast `as any` cosmétique — type `User` déclare le champ) |
| `site.activeAssetCount` (consumption) | ✅ dans `consumption.service` | OK |

**Total T1 :** 27 occurrences audités, **1 bug contract** (déjà corrigé), **0 autre bug**. 🟢 Points cosmétiques :
- `(as any)` omniprésents pour accéder à des champs optionnels : `userDelegations`, `isSuperAdmin`, `tasks`. Sont présents dans les retours back mais absents de l'interface `User` / `Asset` frontend → casts inutiles, à typer proprement.
- `Provider` / `ProviderType` encore exportés dans `frontend/src/types/index.ts` — legacy v1.1 (remplacé par Contact). Jamais utilisé dans les pages existantes. Candidat retrait.

---

## T2 — Formulaires CRUD (new + edit)

**Méthode :** comparaison frais / DTO backend pour les 8 paires de formulaires. Agent Explore dédié.

### Violations 🔴 critiques (submit → 400)

| Formulaire | Fichier:ligne | Écart | Impact |
|---|---|---|---|
| **Sites** | [sites/new/page.tsx:64-65](frontend/src/app/dashboard/sites/new/page.tsx:64) | `address` et `city` déclarés `.optional()` côté front, mais `@ApiProperty()` (requis) côté DTO back | Tout site créé sans adresse/ville → 400 à la soumission |
| **Users password** | [users/new/page.tsx:37](frontend/src/app/dashboard/users/new/page.tsx:37) | Front : `z.string().min(8)`. Back : `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)` (lower + upper + digit) | `"abcdefgh"` accepté front, rejeté back avec message 400 générique |
| **Expenses (UX)** | [costs/new/page.tsx:57](frontend/src/app/dashboard/costs/new/page.tsx:57) | `delegationId = scope.delegationId \|\| undefined` — envoi d'un `undefined` quand le super-admin n'a pas de délégation active. Le back est correct (`@IsNotEmpty()` ; `Expense.delegationId` est OBLIGATOIRE par design — cf. [schema:1109](backend/prisma/schema.prisma:1109) « R1/R2 »). Le modèle "Centre de coût globalisable" est porté par `BillingEntity.delegationId?` (nullable), pas par l'Expense elle-même. | Le front laisse submit, 400 back sans message clair côté UI. **Fix front uniquement** : désactiver le bouton « Créer » + message d'aide « Sélectionnez une délégation active » tant que `delegationId` est absent. |

### Violations 🟡 majeures (bug UX)

| Formulaire | Fichier:ligne | Écart | Impact |
|---|---|---|---|
| **Contact email** | [contacts/new/page.tsx:49](frontend/src/app/dashboard/contacts/new/page.tsx:49) | Front `.max(200)`, back `@MaxLength(100)` | Utilisateur saisit 150 chars → UX confuse (OK client, refusé serveur) |
| **Label `UNDER_MAINTENANCE` absent** | [lib/asset-labels.ts:27-33](frontend/src/lib/asset-labels.ts:27) | `assetStatusLabels` expose `IN_SERVICE / OUT_OF_SERVICE / IN_TRANSIT / STOCK / RETIRED` mais pas `UNDER_MAINTENANCE` — pourtant utilisé côté backend ([consumption.service.ts:48](backend/src/modules/consumption/consumption.service.ts:48)) et affiché dans les tooltips consumption en brut `UNDER_MAINTENANCE` | Utilisateur voit `UNDER_MAINTENANCE` en dur au lieu de « En maintenance » |

### Formulaires OK

- **Racks** : `name` + `siteId` required aligné, `heightU` bornes cohérentes ✅
- **Assets** : `type` required, `status` optional (aligné) ✅
- **Tasks** : `siteId` required, defaults cohérents ✅
- **Floor-plans** : mapping `titre` ↔ `name` propre ligne 145 ✅

**Total T2 :** 8 formulaires audités, **3 🔴 + 1 🟡 + 4 ✅**.

---

## T3 — Cascades champs liés

**Méthode :** trace des `useQuery` avec deps + `onChange → setFoo` + prefill `useEffect`. Agent Explore dédié.

| # | Cascade | Fichier:ligne | Verdict |
|---|---|---|---|
| 1 | `AssetModel → Asset` prefill (watts, prix, U, type, fabricant, modèle) | [assets/new/page.tsx:267-284](frontend/src/app/dashboard/assets/new/page.tsx:267) | ✅ OK — tous les champs repeuplés via `AssetModelSelect.onChange` |
| 2 | `Site → Racks` filtrage par siteId | [racks/[id]/page.tsx:106-111](frontend/src/app/dashboard/racks/[id]/page.tsx:106) + floor-plans | ✅ OK — queryKey rebuild + `enabled: !!siteId` |
| 3 | `Rack → slots U libres` | — | ⚠️ **absent** — pas de composant `RackMountDialog` qui affiche les U disponibles ; backend calcule mais UI n'expose pas. Fonctionnalité manquante, pas un bug. |
| 4 | `Delegation → Site → Asset` (scope) | [api-client.ts:68-73](frontend/src/lib/api-client.ts:68) + [DelegationContext.tsx:80](frontend/src/contexts/DelegationContext.tsx:80) | ✅ OK — `X-Delegation-Id` injecté globalement, `GroupedSiteSelector` utilise le filtre back |
| 5 | `ConnectivityLink → Provider` (contacts catégorie PROVIDER) | [sites/new/page.tsx:150-151, 603](frontend/src/app/dashboard/sites/new/page.tsx:150) | ✅ OK — `useQuery(['contacts', { category: 'PROVIDER' }])` |
| 6 | **`Contact → Catégorie → ContactType`** | [contacts/new/page.tsx:65-68](frontend/src/app/dashboard/contacts/new/page.tsx:65) | 🔴 **CASSÉ** — `useQuery(['contact-types'])` charge **tous les types** sans filtrer par la catégorie sélectionnée. L'utilisateur voit tous les types mélangés. |
| 7 | `FloorPlan pin → Asset` (filtré par site du plan) | [floor-plans/[id]/page.tsx:198-201](frontend/src/app/dashboard/floor-plans/[id]/page.tsx:198) | ✅ OK — queryKey + `getAll({ siteId })` |
| 8 | **`Budget → Délégation/Site/Type`** | [costs/budgets/page.tsx:49-51, 317-340](frontend/src/app/dashboard/costs/budgets/page.tsx:49) | 🟡 **MAJEUR** — Select Délégation + Type présents, mais **pas de Select Site**. Et `queryKey: ['budgets']` ne dépend pas de la délégation active → si l'utilisateur change de délégation, la liste reste stale. |

**Total T3 :** 8 cascades, **1 🔴 + 1 🟡 + 6 ✅ (ou absence non-bloquante)**.

---

## T4 — Permissions UI ↔ backend

**Méthode :** Grep tous les usages `canCreate/Update/Delete/canManage` + croisé avec les décorateurs backend réels. Agent Explore dédié.

### Failles 🔴 — UI affiche un bouton → backend 403

| Page × Action | Frontend gate | Endpoint | Décorateur back réel | Impact |
|---|---|---|---|---|
| **users / « Inviter »** | `canAct = canManage \|\| isSuperAdmin` ([users/page.tsx:52,168](frontend/src/app/dashboard/users/page.tsx:52)) | `POST /auth/invite` | Classe `@SkipDelegation()` + méthode `@RequireManage()` = super-admin only | Un MANAGE local voit le bouton, clique → 403 « Forbidden ». Déjà flaggué phase 5 T1 (docstring ambigu). |
| **settings → Tenant (form save)** | `isAdmin` ([settings/page.tsx:2132](frontend/src/app/dashboard/settings/page.tsx:2132)) | `PATCH /tenants/current` | Classe `@SkipDelegation()+@RequireManage()` + méthode `@RequireWrite()` = super-admin only | MANAGE local voit le formulaire éditable, clique Save → 403 |
| **settings → Backup (tous les boutons)** | `isAdmin` ([settings/page.tsx:2989](frontend/src/app/dashboard/settings/page.tsx:2989)) | `POST /backup/*` | Classe `@SkipDelegation()+@RequireManage()` = super-admin only | MANAGE local voit onglet Sauvegardes, tente de lancer backup → 403 |

**Root cause commune** : `isAdmin` (= MANAGE local OR super-admin) est utilisé pour gater des actions **tenant-wide**. Seul `isSuperAdmin` devrait gater ces boutons.

### ✅ Pages correctes

- `settings → Modules / Types / Models / Électricité` : gates `isSuperAdmin` ([settings/page.tsx:2302, 2333, 2339](frontend/src/app/dashboard/settings/page.tsx:2302)) ✅
- Pages `/users`, `/admin/audit`, `/sites/[id]/edit` : `AccessGate` déjà aligné phase 5 T8 ✅

### Violation 🔴 bonus — Sidebar expose une page super-admin aux MANAGE locaux

[layout.tsx:69-73, 241](frontend/src/app/dashboard/layout.tsx:69) : `adminNavigation` contient deux items (`Utilisateurs` + `Journal d'audit`), affichés dès que `isAdmin` = MANAGE local OR super-admin. Or `GET /audit` est super-admin only (phase 5 T4 a confirmé le décorateur backend + `AccessGate required="super-admin"` sur la page). Un Manager voit le lien dans la sidebar → clique → [AccessGate](frontend/src/app/dashboard/admin/audit/page.tsx:29) affiche « Accès refusé » 1.5 s puis redirect : UX bâtarde.

**Fix** : typer les items de `adminNavigation` avec un flag `superAdminOnly` et filtrer avant `.map()`. Utilisateurs reste MANAGE, Journal d'audit devient `superAdminOnly: true`.

**Total T4 :** **3 🔴 failles permissions + 1 🔴 sidebar** + reste aligné.

---

## T5 — États loading / empty / error

**Méthode :** Grep `isLoading`, `.length === 0`, `useQuery` sans `error`. Agent Explore dédié.

### Cas problématiques

| Page | Fichier:ligne | Problème | Verdict |
|---|---|---|---|
| `assets/page` | [assets/page.tsx:253-269](frontend/src/app/dashboard/assets/page.tsx:253) | `useQuery` sans gestion `error` — erreur réseau → page vierge silencieuse | 🟡 UX dégradée |
| `alerts/page` | [alerts/page.tsx:38-50](frontend/src/app/dashboard/alerts/page.tsx:38) | 3 `useQuery` indépendantes sans loading state global : si une échoue, les autres affichent data partielle sans signalement | 🟡 UX dégradée |
| `admin/audit/page` | [admin/audit/page.tsx:51-161](frontend/src/app/dashboard/admin/audit/page.tsx:51) | Utilise `useState` + `async` au lieu de `useQuery` → cache miss sur reload, `catch { setItems([]) }` silencieux ligne 60 | 🟡 UX dégradée |
| `racks/page`, `tasks/page`, `sites/page` | cf. agent report | `useQuery` sans gestion `error` (même pattern que assets) | 🟡 UX dégradée |

Toutes les pages ont loading + empty states corrects. Le problème est uniquement l'absence de gestion d'erreur visible.

**Total T5 :** 5 pages sans gestion d'erreur, **0 🔴 bloquant** mais **UX dégradée globale**.

---

## T6 — Routing & navigation

**Méthode :** Grep `href=`, `router.push`, `router.replace`, `redirect(` + cross-check avec `frontend/src/app/**/page.tsx`. Agent Explore dédié.

### Résultat

✅ **Aucun lien cassé détecté.** Tous les `href` pointent vers des routes existantes. Les chemins retirés en phase 5 (`/providers`, `/auth-providers`) n'étaient déjà plus référencés côté frontend avant leur suppression.

**Total T6 :** ✅ OK.

---

## T7 — Terminologie & labels

### Violations 🔴 critiques (AUTH_MODEL v1 obsolète dans le code)

| Fichier:ligne | Problème | Fix |
|---|---|---|
| [settings/page.tsx:521](frontend/src/app/dashboard/settings/page.tsx:521) | `const XCH_ROLES = ['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER']` en dur (AUTH_MODEL v1, dépréciée depuis v1.2) | Remplacer par `['MANAGE', 'WRITE', 'READ']` ou retirer si inutile |
| [settings/page.tsx:568-571](frontend/src/app/dashboard/settings/page.tsx:568) | Mapping SSO en dur avec les valeurs v1 (ADMIN → ADMIN etc.) | Remplacer par `DelegationRight` (MANAGE/WRITE/READ). Cohérent avec la refonte OIDC strategy de phase 5 Lot 2 qui normalise déjà ces labels côté back. |

### Violations 🟡 majeures (incohérence FR)

| Fichier:ligne | Affiche | Attendu |
|---|---|---|
| [users/page.tsx:34-35](frontend/src/app/dashboard/users/page.tsx:34) | `'Écriture'` / `'Lecture'` | `rightLabel()` du helper (`frontend/src/lib/labels.ts`) retourne `'Éditeur'` / `'Lecteur'` |
| [users/[id]/edit/page.tsx:62-63, 82-83](frontend/src/app/dashboard/users/[id]/edit/page.tsx:62) | idem (2 occurrences) | idem |
| [users/new/page.tsx:52-53](frontend/src/app/dashboard/users/new/page.tsx:52) | idem | idem |
| [netbox/page.tsx:55](frontend/src/app/dashboard/netbox/page.tsx:55) + `integrations/netbox/page.tsx:49` | Status `'Preparation'` brut (anglais) | `siteStatusLabel()` retourne `'En préparation'` |
| [admin/audit/page.tsx:121](frontend/src/app/dashboard/admin/audit/page.tsx:121) | `<option value="DELETE">DELETE</option>` (et CREATE/UPDATE) | Traduire en Créer/Modifier/Supprimer |

### Violations 🟡 majeures — UX verbeuse (feedback utilisateur direct)

| Fichier:ligne | Problème | Proposition |
|---|---|---|
| [notifications/page.tsx:62-68](frontend/src/app/dashboard/notifications/page.tsx:62) + [settings/notifications/page.tsx:236-240](frontend/src/app/dashboard/settings/notifications/page.tsx:236) | Les deux pages Notifications (Inbox et Config) se référencent l'une l'autre en texte long et narratif (« Configurer les règles (qui reçoit quoi) », « Pour consulter vos notifications personnelles, ouvrez la cloche en haut à droite »). Verbeux, peu pro. | **Inbox** : retirer le lien inline dans le sous-titre, ajouter un bouton icône `Settings` secondaire à côté de « Tout marquer lu » (aria-label « Configurer les notifications »). Sous-titre reste « N non lue(s) » ou « Tout est lu ». **Config** : sous-titre devient « Canaux et événements suivis par délégation. » (point). La cloche header rend le rappel redondant. |
| [consumption/page.tsx:43-52](frontend/src/app/dashboard/consumption/page.tsx:43) | Explainer « Comment lire ce tableau ? » en 6 lignes verbeuses dans un bloc coloré, qui cite en plus les statuts bruts `IN_SERVICE / UNDER_MAINTENANCE` en anglais. | Remplacer par une icône `Info` cliquable à côté de l'en-tête de colonne « Assets ». Popover shadcn avec le contenu : « Total des équipements liés au site. **Actifs** = **En service** + **En maintenance** — seuls ces équipements consomment. » (labels FR cohérents avec la page Équipements, cf. fix `UNDER_MAINTENANCE` ci-dessus en T2). |

**Total T7 :** **2 🔴 + 4 🟡 labels + 2 🟡 UX verbeuse** — harmonisation via helpers existants + Popover shadcn.

---

## T8 — React Query hygiène

### Problèmes détectés

| Problème | Exemples | Verdict |
|---|---|---|
| **Mutations sans `onError` toast** | `contacts/[id]` updateMutation, `costs/budgets` + `costs/entities` deleteMutation | 🟡 UX dégradée — action échoue sans feedback visuel |
| **`staleTime` défaut 60s globalement** | `app/providers.tsx:15` | 🟡 UX dégradée — clignotement lors de refocus de fenêtre sur listes paginées |
| **QueryKeys divergents** | `['contacts']` global vs `['contacts', {filters}]` paginé → caches séparés | 🟡 UX dégradée — après un create, la liste paginée reste stale jusqu'au refresh manuel |
| **`invalidateQueries` trop large** | `assets/[id]/page.tsx:109` invalidate `['assets']` entier | 🟢 amélioration — refetch inutile de 25 items à chaque update asset |

### ✅ Points positifs

- 25+ mutations avec `onSuccess` + `invalidateQueries` corrects (assets, users/[id]/edit, contacts list, sites, floor-plans)
- `enabled: deps` correctement utilisé partout — aucun fetch prématuré détecté
- Toasts systématiques sur create/update/delete (97% coverage)

**Total T8 :** **0 🔴 + quelques 🟡 à uniformiser.**

---

## T9 — A11y minimal

| Fichier:ligne | Problème | Verdict |
|---|---|---|
| [components/InlineEditCard.tsx:66-73](frontend/src/components/InlineEditCard.tsx:66) | Bouton éditer icon-only sans `aria-label` — composant **réutilisé** dans asset detail, settings, etc. → impact systémique | 🔴 bloquant lecteur d'écran |
| [admin/audit/page.tsx:95-140](frontend/src/app/dashboard/admin/audit/page.tsx:95) | Formulaire `<input>` HTML bruts + `<label>` sans `htmlFor` → labels non associés sémantiquement (3 inputs touchés) | 🔴 bloquant |
| [assets/page.tsx:330-335](frontend/src/app/dashboard/assets/page.tsx:330) | Barre de recherche `<Input>` sans `aria-label` ni `id` (placeholder uniquement) | 🔴 bloquant |
| [costs/entities/page.tsx:211-223](frontend/src/app/dashboard/costs/entities/page.tsx:211) | Boutons Pencil/Trash2 icon-only sans aria-label (×2 par ligne) | 🟡 dégradation |
| [costs/new/page.tsx:326-328](frontend/src/app/dashboard/costs/new/page.tsx:326) | Bouton `X` delete allocation sans aria-label | 🟡 dégradation |

### ✅ Bons points

- shadcn/ui fournit Dialog/Label/Select/Table avec a11y native — focus trap, aria-* gérés automatiquement
- Dark mode couvert via `bg-background`/`text-foreground` partout sauf exceptions rares
- Pas de tables sans `<th>` / `<th scope>` détectées

**Total T9 :** **3 🔴 + 2 🟡**, 2-3 jours de fixes rapides.

---

## Plan de correctifs proposés

| Prio | Violation | Fix proposé | Charge estimée |
|---|---|---|---|
| 🔴 P0 | Sites : `address`/`city` required back, optional front (T2) | Ajouter `required()` dans le schema zod + marquer visuellement obligatoire | 15 min |
| 🔴 P0 | Expenses (UX) : submit laisse passer `undefined` sur `delegationId` quand pas de délégation active (T2) | Côté front uniquement : désactiver le bouton « Créer » tant que `scope.delegationId` absent + message d'aide « Sélectionnez une délégation active ». Le schema back est correct — `Expense.delegationId` est obligatoire par design (cf. `BillingEntity.delegationId?` qui porte la dimension Global/Délégation pour les Centres de coût). | 15 min |
| 🔴 P0 | Sidebar expose `Journal d'audit` aux MANAGE locaux (T4 bis) | Ajouter `superAdminOnly: true` sur l'item dans `adminNavigation` + filtre `.filter(i => !i.superAdminOnly \|\| isSuperAdmin)` avant le `.map()` dans [layout.tsx:247](frontend/src/app/dashboard/layout.tsx:247). `Utilisateurs` reste MANAGE. | 10 min |
| 🔴 P0 | Users : password regex incohérent (T2) | Aligner la regex zod avec le back : `.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, 'Au moins 1 majuscule, 1 minuscule, 1 chiffre')` | 20 min |
| 🔴 P0 | Permissions UI : 3 failles boutons visibles (T4) | Remplacer `isAdmin` par `isSuperAdmin` dans users/page.tsx:52, settings/page.tsx:2132, :2989. Masquer les onglets/sections concernés aux MANAGE locaux. | 45 min |
| 🔴 P0 | Contact → ContactType : pas de filtre catégorie (T3) | Passer `categoryFilter` dans le `useQuery(['contact-types', category])` + filtre back + front | 30 min |
| 🔴 P0 | SSO mapping hardcodé v1 dans settings (T7) | Remplacer `XCH_ROLES` par `['MANAGE', 'WRITE', 'READ']`. Aligner avec OIDC strategy déjà refondue phase 5 Lot 2. | 20 min |
| 🟡 P1 | Budget : select Site manquant + queryKey ne suit pas délégation (T3) | Ajouter `<Select site>` dans le form Budget + `queryKey: ['budgets', delegationId]` | 45 min |
| 🟡 P1 | Contact email max 100/200 (T2) | Aligner front sur back (`.max(100)`) | 5 min |
| 🟡 P1 | `UNDER_MAINTENANCE` absent du helper (T2) | Ajouter `UNDER_MAINTENANCE: 'En maintenance'` dans [lib/asset-labels.ts:27-33](frontend/src/lib/asset-labels.ts:27) + couleur associée dans `assetStatusColors` (suggéré `warning`). | 5 min |
| 🟡 P1 | Inbox ↔ Config notifications — textes verbeux (T7) | [notifications/page.tsx:62-68](frontend/src/app/dashboard/notifications/page.tsx:62) : retirer le lien inline, ajouter bouton icône `Settings` (aria-label + tooltip « Règles et canaux »). [settings/notifications/page.tsx:236-240](frontend/src/app/dashboard/settings/notifications/page.tsx:236) : sous-titre « Canaux et événements suivis par délégation. ». | 15 min |
| 🟡 P1 | Explainer Consumption verbeux + statuts en anglais (T7) | [consumption/page.tsx:43-52](frontend/src/app/dashboard/consumption/page.tsx:43) : supprimer le bloc `<div>`. Ajouter icône `Info` à côté de l'en-tête « Assets » → Popover shadcn avec : « Total des équipements liés au site. **Actifs** = **En service** + **En maintenance** — seuls ces équipements consomment. » | 20 min |
| 🟡 P1 | Labels `Écriture/Lecture` vs `Éditeur/Lecteur` (T7) | Remplacer les 4 occurrences par `rightLabel()` | 10 min |
| 🟡 P1 | Netbox status `Preparation` anglais (T7) | Remplacer par `siteStatusLabel(status)` | 5 min |
| 🟡 P1 | Audit log select action en anglais (T7) | Mapper CREATE/UPDATE/DELETE → Créer/Modifier/Supprimer | 10 min |
| 🟡 P2 | A11y : aria-label sur InlineEditCard (T9) | Ajouter `aria-label={editLabel \|\| 'Modifier'}` sur le bouton icon-only | 5 min (impact systémique) |
| 🟡 P2 | A11y : formulaire audit avec inputs HTML bruts (T9) | Remplacer par `<Label htmlFor>` + `<Input>` shadcn | 30 min |
| 🟡 P2 | A11y : search Input sans aria-label (T9) | Ajouter `aria-label="Rechercher un équipement"` | 2 min |
| 🟡 P2 | A11y : boutons costs/entities + costs/new (T9) | `aria-label="Modifier"`, `aria-label="Supprimer"`, `aria-label="Supprimer cette allocation"` | 10 min |
| 🟡 P2 | React Query : mutations sans onError (T8) | Ajouter `onError: (err) => showToast.error(...)` sur contacts/[id], costs/budgets, costs/entities | 20 min |
| 🟢 P3 | Typing : `(as any).userDelegations` dans users/page (T1) | Créer interface `UserWithDelegations extends User { userDelegations: UserDelegation[] }` + typer la query result | 15 min |
| 🟢 P3 | Type legacy `Provider` / `ProviderType` (T1) | Retirer de `frontend/src/types/index.ts` — plus utilisé depuis Contacts v1.1 | 5 min |
| 🟢 P3 | `staleTime` global trop court (T8) | Passer le default à 5 min + list-pages à 2 min dans `app/providers.tsx` | 10 min |
| 🟢 P3 | QueryKeys divergents assets/contacts/users (T8) | Uniformiser format `[resource, filters?]` | 45 min |
| 🟢 P3 | Audit page : migrer state+fetch → useQuery (T5) | Refacto propre | 30 min |

**Charge totale estimée :**
- **P0 (7 critiques) : ~2h00** — Sites / Users password / Expenses UX / Contact type cascade / 3 failles permissions UI / SSO mapping / Sidebar audit
- **P1 (8 majeurs) : ~1h50** — Budget site + queryKey / Contact email / labels FR / UNDER_MAINTENANCE / Inbox↔Config sobres / Popover consumption / netbox / audit select
- **P2 (a11y + mutations) : ~1h10** — aria-label + labels non associés + onError toasts
- **P3 (cosmétiques) : ~1h45**

**Total : ~6h45** pour P0 + P1 + P2 (priorité démo pilote).

## Évolutions à planifier (hors audit phase 6)

| # | Feature | Contexte |
|---|---|---|
| 1 | **Centre de coût (BillingEntity) + Expense UX** | Le schema actuel supporte déjà `BillingEntity.delegationId?` = Global / Délégation (phase 5 schema confirmé). `Expense.delegationId` reste obligatoire par design. À vérifier pendant l'ADR-011 « Dépense inline » : s'assurer que l'UX du sélecteur Centre de coût sur le form Expense affiche bien la portée (Globale / nom de la délégation). |
| 2 | **Dépense inline** | ADR-011 prévu après les correctifs phase 6 (pouvoir créer/associer une Expense depuis les formulaires asset / connectivity / task). |
| 3 | **Gatus bidirectionnel** | ADR-012 prévu après ADR-011 (auto-register monitors + positionnement du routing notifications). |

---

## Pre-audit finding déjà corrigé

- **`_count.userDelegations` absent de `findOneDelegation`** → « Membres : 0 » sur `/dashboard/settings` onglet Ma délégation. Fix commit [`3c58480`](https://github.com/eoncom/XCH/commit/3c58480), aligné avec `findAllDelegations` qui incluait déjà `_count`. Validé via curl post-deploy : `_count: { sites: 6, userDelegations: 6 }` retourné sur IDF Ouest.

---

## Commandes / méthodes utilisées

```bash
# T1 — contract
Grep "\\(as any\\)?\\.|_count\\?\\." frontend/src
Grep "?? []|?? 0|?? {}" frontend/src
Grep "_count" backend/src/modules --glob="*.service.ts"
Read backend/src/modules/{organization,asset-models,floor-plans,users,assets,consumption}/*.service.ts

# T2 à T9 — délégué à 6 agents Explore en parallèle
Agent(T2 forms, subagent_type=Explore, thoroughness=very thorough)
Agent(T3 cascades, subagent_type=Explore, thoroughness=very thorough)
Agent(T4 UI permissions, subagent_type=Explore, thoroughness=very thorough)
Agent(T5+T8 states + RQ, subagent_type=Explore, thoroughness=very thorough)
Agent(T6+T7 routing + labels, subagent_type=Explore, thoroughness=very thorough)
Agent(T9 a11y, subagent_type=Explore, thoroughness=very thorough)

# Chaque agent a utilisé : Glob + Grep + Read (pas d'exécution, pas de dev server)
```

---

## Limites connues de cet audit

- **Pas de validation runtime** : l'audit est entièrement statique. Tester réellement les 4 formulaires cassés (T2) demande un dev server + soumission.
- **Pas de vérification contrast computé** (T9) : lecture visuelle des classes Tailwind seulement.
- **Pas de couverture des `components/`** en profondeur : seulement les `components/` utilisés par les pages auditées.
- **Pas de WCAG complet** (T9) — 5-8 cas prioritaires seulement, comme demandé.
- **Types TypeScript** : l'absence de `node_modules` et de Prisma client généré localement empêche un `tsc --noEmit` fiable sur Windows. Le build serveur (webpack) a passé phase 5 mais peut masquer des implicit-any.

---

**Fin du rapport.** Décision sur priorisation et scope correctifs : à toi.
