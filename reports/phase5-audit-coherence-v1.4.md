# Phase 5 — Audit de cohérence backend v1.4.x

**Date :** 2026-04-19
**Auteur :** Claude Opus 4.7 (1M context) — worktree `mystifying-yalow-ebe6ab`
**Outils :** MCP memory (19 entités XCH), MCP code-graph, Grep, Read, Bash
**Version testée :** v1.4.0 (tag git courant) / v1.4.x (état branche)

---

## Résumé exécutif

- **Règles vérifiées :** R1 à R8 (AUTH_MODEL_V2) + 9 tâches (T1–T9)
- **Violations critiques :** **3** — blocage fonctionnel ou faille de privilège
- **Violations majeures :** **4** — scope incorrect ou code sémantiquement mort mais protégé
- **Drift documentation :** **8** — doc et code divergent sur chemins, URLs ou modèles
- **Code mort :** **3 blocs** — `handleLegacy` + model `AuthProvider` + controller `providers-legacy`
- **Faux positifs documentés :** **12** (Contact.role, ConnectivityLink.role, NetBox remote, defensive `delete (data as any).role`, etc.)
- **Métriques PROJECT_STATUS :** 9/9 fidèles (aucun drift chiffré)
- **Verdict global :** 🟡 **À CORRIGER AVANT PILOTE PROD** — 3 correctifs critiques avant de continuer la roadmap déploiement. La posture Casbin retiré / `User.role` supprimé est saine (R3, R4 ✅).

> **Source règles :** entité mémoire `AUTH_MODEL_V2` + `docs/architecture/AUTH_MODEL.md`.

---

## Socle — localisation guards et décorateurs

| Fichier | Chemin réel | Rôle |
|---|---|---|
| PermissionGuard | `backend/src/common/guards/permission.guard.ts` | fail-closed, APP_GUARD |
| DelegationGuard | `backend/src/common/guards/delegation.guard.ts` | lit `X-Delegation-Id`, attache `request.localRole = UserDelegation.right` |
| Require decorators | `backend/src/common/decorators/require-right.decorator.ts` | exporte `RequireRead/Write/Manage` + clé `REQUIRED_RIGHT_KEY` |
| SkipDelegation | `backend/src/common/guards/delegation.guard.ts` (clé `SKIP_DELEGATION_GUARD`) | shortcut global routes |
| `APP_GUARD` ordre | [app.module.ts:102-118](backend/src/app.module.ts:102) | XchThrottler → JWT → Delegation → Permission ✅ |

**R8 :** ✅ `PermissionGuard` est bien enregistré comme `APP_GUARD` global.

**Méthode :** `Glob` + `Read` des 4 fichiers socle, lecture de `app.module.ts`.

---

## Tâche 1 — Controllers sans décorateur d'autorisation

**Méthode :** `Grep @(Get|Post|Patch|Put|Delete)\(` puis `Grep @(Require(Read|Write|Manage)|SkipDelegation|Public)\(` (count par fichier). Écart brut → `Read` des controllers suspects.

**Périmètre audité :** **32 controllers, 262 endpoints** (confirme PROJECT_STATUS.md).

### Violations CRITIQUES

| Endpoint | Fichier:ligne | Méthode | Décorateurs trouvés | Verdict |
|---|---|---|---|---|
| `GET /notifications/meta` | [notification.controller.ts:36](backend/src/modules/notifications/notification.controller.ts:36) | GET | aucun (classe : `@UseGuards(JwtAuthGuard)` seul) | 🔴 fail-closed → tout non-super-admin reçoit 403 |
| `GET /notifications/config` | [notification.controller.ts:48](backend/src/modules/notifications/notification.controller.ts:48) | GET | aucun | 🔴 idem |
| `GET /notifications/config/resolved` | [notification.controller.ts:63](backend/src/modules/notifications/notification.controller.ts:63) | GET | aucun | 🔴 idem |
| `PUT /notifications/config` | [notification.controller.ts:76](backend/src/modules/notifications/notification.controller.ts:76) | PUT | aucun | 🔴 idem |
| `DELETE /notifications/config/:delegationId` | [notification.controller.ts:91](backend/src/modules/notifications/notification.controller.ts:91) | DELETE | aucun | 🔴 idem |
| `GET /notifications/configs` | [notification.controller.ts:105](backend/src/modules/notifications/notification.controller.ts:105) | GET | aucun | 🔴 idem |
| `POST /notifications/test` | [notification.controller.ts:115](backend/src/modules/notifications/notification.controller.ts:115) | POST | aucun | 🔴 idem |
| `GET /notifications/logs` | [notification.controller.ts:125](backend/src/modules/notifications/notification.controller.ts:125) | GET | aucun | 🔴 idem |
| `POST /integrations/monitoring/webhook` | [monitoring-webhook.controller.ts:35](backend/src/modules/integrations/controllers/monitoring-webhook.controller.ts:35) | POST | aucun (commentaire dit « NOT protected ») | 🔴 JwtAuthGuard global → **401 sur TOUS les webhooks externes** |

### Observations (OK mais confusion)

- `UserNotificationController` (`/notifications/inbox/*`, 5 endpoints) : classe `@SkipDelegation()` mais pas de `@Require*` — OK car PermissionGuard.canActivate ligne 57-58 retourne `true` quand skipDelegation + pas de requiredRight. ✅
- `SetupController` : classe `@Public() + @SkipDelegation()` — OK (wizard premier lancement). ✅
- `AuthController` : 20 endpoints, tous couverts (classe `@SkipDelegation()` + `@Public()` ou `@RequireManage()` explicites). ✅

**Méthode utilisée :** Grep counts → `Read` de [notification.controller.ts](backend/src/modules/notifications/notification.controller.ts), [user-notification.controller.ts](backend/src/modules/notifications/user-notification.controller.ts), [setup.controller.ts](backend/src/modules/setup/setup.controller.ts), [monitoring-webhook.controller.ts](backend/src/modules/integrations/controllers/monitoring-webhook.controller.ts), [auth.controller.ts](backend/src/modules/auth/auth.controller.ts).

**Totaux T1 :** 262 endpoints audités · **9 violations critiques** (tout `notification.controller.ts` + webhook monitoring) · 0 faux positif.

---

## Tâche 2 — Fuites Casbin (R3)

**Méthode :** `Grep "casbin|CasbinRule|casbinRule|newEnforcer|Enforcer"` sur `backend/src`, `backend/prisma`, `docs/`.

| Périmètre | Matches | Verdict |
|---|---|---|
| `backend/src` | **0** | ✅ R3 respecté |
| `backend/prisma/schema.prisma` | **0** | ✅ Modèle `CasbinRule` absent |
| `docs/` (toutes archives incluses) | 17 fichiers | à classer |

### Classification des 17 mentions doc

| Fichier | Verdict | Motif |
|---|---|---|
| `docs/decisions/adr-004-rbac-casbin.md` | ✅ OK-historique | ADR archivé |
| `docs/architecture/AUTH_MODEL.md` | ✅ OK-historique | mentionne retrait v1.3 dans §9 Historique |
| `docs/archive/**` (8 fichiers) | ✅ OK-archive | répertoire dédié |
| `docs/sessions/SESSION_6/9_*.md` | ✅ OK-historique | logs session |
| `docs/V2_STRATEGY_PROPOSAL.md` | ✅ OK-historique | proposition figée |
| `docs/agents/agent-backend-providers-crud.md` | ✅ OK-historique | fiche agent figée |
| **`docs/00-INDEX.md`** | ⚠️ DRIFT DOC | ligne 181 présente ADR-004 au présent sans flag « superseded by ADR-009 » |
| **`docs/architecture/database-schema.md`** | ⚠️ DRIFT DOC | lignes 663-708 présentent `model CasbinRule` + `prisma db seed` (policies Casbin) comme actifs |
| **`docs/guides/DEVELOPMENT_GUIDE.md`** | ⚠️ DRIFT DOC | lignes 32, 46-48, 425-707 décrivent le module Casbin comme s'il existait |

**Totaux T2 :** code = 0 fuite · doc = **3 drifts** + 14 OK-historique/archive.

---

## Tâche 3 — Survivants `user.role` (R4)

**Méthode :** plusieurs passes Grep (`user\.role`, `role:\s*['\"](ADMIN|MANAGER|...)`, `UserRole\.`, puis `.role` général en triage manuel) + inspection du schema Prisma.

**Résultat R4 :** ✅ `User.role` **n'existe plus** dans `backend/prisma/schema.prisma` (grep `^\s*role\s` → 2 matches : `Contact.role @db.VarChar(100)` + `ConnectivityLink.role ConnectivityRole`). L'enum `UserRole` : 0 occurrence en code.

### Matches `.role` classifiés (16 lignes)

| Fichier:ligne | Snippet | Verdict |
|---|---|---|
| `connectivity-migration.ts:152` | `role: link.role` | ✅ OK — ConnectivityLink.role |
| `backup.service.ts:596` | `role: contact.role` | ✅ OK — Contact.role |
| `connectivity.service.ts:29, 49` | `role: dto.role` / `where.role` | ✅ OK — ConnectivityLink |
| `health-aggregation.service.ts:98, 239` | `link.role` / `link.role === 'primary'` | ✅ OK — ConnectivityLink |
| `integrations.service.ts:1004` | `role: mappedData.role` | ✅ OK — Contact mapping |
| `netbox-sync.service.ts:288` | `nbDevice.role.name` | ✅ OK — remote NetBox |
| `seed.service.ts:1171, 1179` | `role: d.role` | ✅ OK — Contact seed |
| `users.service.ts:230` | `delete (data as any).role` | ✅ OK-defensive — neutralise un éventuel `.role` résiduel d'un payload |
| `notification.controller.ts:136, 144, 159` | commentaire `(UserDelegation.role)` | ⚠️ **DRIFT COMMENTAIRE** — le champ s'appelle `.right`, les valeurs sont MANAGE/WRITE/READ |
| `oidc.strategy.ts:99, 115` | `entry.role` / `defaultEntry.role` | ⚠️ **SEMANTIC DEAD-CODE SSO** — cf. encart ci-dessous |

### Dead-code SSO — encart détaillé

[oidc.strategy.ts:93-150](backend/src/modules/auth/strategies/oidc.strategy.ts:93) mappe les groupes OIDC vers un `role` string (`ADMIN`/`MANAGER`/`TECHNICIEN`/`VIEWER`) puis appelle [auth.service.ts:152 `oidcLogin(profile, tenantId, role, delegationEntries)`](backend/src/modules/auth/auth.service.ts:152). Dans `oidc.strategy.ts:76` le `role` est injecté dans chaque entry de `delegationEntries` en tant que champ `role`. **Mais** [auth.service.ts:199](backend/src/modules/auth/auth.service.ts:199) lit `d.right || 'READ'` — **`d.role` est ignoré**. Le rôle SSO est silencieusement drop, tous les nouveaux users OIDC se retrouvent en READ.

Impact sécurité : fail-safe (dégrade vers READ, pas élévation) mais **l'intent produit est cassé** : configurer `roleMapping.admin=ADMIN` ne donne plus les droits admin.

**Totaux T3 :** 16 matches `.role` · **0 DANGER** d'autorisation côté backend (schema sain) · **2 drifts sémantiques** (commentaires notification + mapping SSO) · 12 faux positifs OK.

---

## Tâche 4 — Super-admin routes mal protégées

**Méthode :** `Read` des controllers cités par la spec + `organization.controller.ts`. Hiérarchie appliquée : MANAGE ⊃ WRITE ⊃ READ. Pour routes `@SkipDelegation`, PermissionGuard ligne 57-68 → `READ` passe pour tout authentifié, `WRITE`/`MANAGE` exige `isSuperAdmin`.

| Endpoint spec | Décorateur observé | Effectif | Verdict |
|---|---|---|---|
| `POST /delegations` | `@SkipDelegation() + @RequireManage()` [organization.controller.ts:24-26](backend/src/modules/organization/organization.controller.ts:24) | super-admin | ✅ |
| `DELETE /delegations/:id` | `@SkipDelegation() + @RequireManage()` [organization.controller.ts:64-66](backend/src/modules/organization/organization.controller.ts:64) | super-admin | ✅ |
| `POST /admin/enum-labels` | classe `@SkipDelegation() + @RequireManage()` + méthode `@RequireWrite()` | super-admin (WRITE sur SkipDel = isSuperAdmin) | ✅ fonctionnel, décorateur méthode confus |
| `DELETE /admin/enum-labels/:id` | `@RequireManage()` | super-admin | ✅ |
| `POST /auth-providers/*` | **N'EXISTE PAS** | — | ⚠️ Endpoint fantôme cité par AUTH_MODEL.md §7 |
| `PATCH /tenants/modules` | classe `@SkipDelegation()+@RequireManage()` + `@RequireWrite()` | super-admin | ✅ |
| `PATCH /tenants/sso-config` | idem | super-admin | ✅ |
| `PATCH /tenants/appearance` | classe `@SkipDelegation()+@RequireManage()` + `@RequireManage()` | super-admin | ✅ |
| `POST /asset-models/import/upload` | classe `@SkipDelegation()` + `@RequireManage()` | super-admin | ✅ |
| `POST /asset-models/import/:vendor` | `@RequireManage()` | super-admin | ✅ |
| `DELETE /asset-models/catalogs/:id` | `@RequireManage()` | super-admin | ✅ |
| `POST /users` | `@RequireManage()` (pas SkipDelegation) | MANAGE **local** délégation | 🟡 spec T4 dit « super admin only »; AUTH_MODEL.md §1 autorise un MANAGE local à inviter — **OK fonctionnel, spec ambiguë** |
| `DELETE /users/:id` | `@RequireManage()` (pas SkipDelegation) | MANAGE **local** délégation | 🟡 idem |

### Violations T4 détectées en scan élargi

| Endpoint | Fichier:ligne | Décorateur | Attendu | Impact |
|---|---|---|---|---|
| `POST /user-delegations` | [user-delegations.controller.ts:18-19](backend/src/modules/user-delegations/user-delegations.controller.ts:18) | `@RequireWrite()` | `@RequireManage()` (docstring dit « ADMIN of the delegation ») | 🔴 **élévation privilège** — un WRITE local peut promouvoir en MANAGE |
| `PATCH /user-delegations/:userId/:delegationId` | [user-delegations.controller.ts:63-64](backend/src/modules/user-delegations/user-delegations.controller.ts:63) | `@RequireWrite()` | `@RequireManage()` | 🔴 idem |
| `DELETE /user-delegations/:userId/:delegationId` | [user-delegations.controller.ts:84-85](backend/src/modules/user-delegations/user-delegations.controller.ts:84) | `@RequireWrite()` | `@RequireManage()` | 🔴 un WRITE local peut retirer un MANAGE de la délégation |
| `PATCH /delegations/:id` | [organization.controller.ts:57-58](backend/src/modules/organization/organization.controller.ts:57) | `@RequireWrite()` | `@RequireManage()` (AUTH_MODEL.md §7 onglet « Ma délégation ») | 🟡 renommage / config altérable par un WRITE |

**Totaux T4 :** 13 routes spec vérifiées · **3 critiques + 1 majeur** sur user-delegations + delegation edit · 1 drift doc (auth-providers fantôme) · 2 interprétations divergentes (POST/DELETE /users).

---

## Tâche 5 — Endpoints `/me` et `/my-*`

**Méthode :** `Grep "['\"]me['\"]|['\"]me\/"` sur controllers + `Read` ciblé.

| Endpoint | Fichier:ligne | Décorateur | Scope | Verdict |
|---|---|---|---|---|
| `GET /users/me/profile` | [users.controller.ts:103-104](backend/src/modules/users/users.controller.ts:103) | `@SkipDelegation()` + `req.user.userId` | user | ✅ |
| `PUT /users/me/profile` | users.controller.ts:110-111 | `@SkipDelegation()` + `req.user.userId` | user | ✅ |
| `POST /users/me/change-password` | users.controller.ts:117-118 | `@SkipDelegation()` + `req.user.userId` | user | ✅ |
| `GET /users/me/appearance` | users.controller.ts:130-131 | `@SkipDelegation()` + `req.user.userId` | user | ✅ |
| `PATCH /users/me/appearance` | users.controller.ts:137-138 | `@SkipDelegation()` + `req.user.userId` | user | ✅ |
| `GET /users/me/effective-appearance` | users.controller.ts:147-148 | `@SkipDelegation()` + `req.user.userId` | user | ✅ |
| `GET /notifications/inbox/me` | user-notification.controller.ts:25 | classe `@SkipDelegation()` + `req.user.id` | user | ✅ |
| `GET /notifications/inbox/count-unread` | user-notification.controller.ts:40 | idem | user | ✅ |
| `PATCH /notifications/inbox/:id/read` | user-notification.controller.ts:46 | idem + filter userId dans service | user | ✅ |
| `POST /notifications/inbox/mark-all-read` | user-notification.controller.ts:54 | idem | user | ✅ |
| `DELETE /notifications/inbox/:id` | user-notification.controller.ts:60 | idem | user | ✅ |
| `GET /auth/my-permissions` | auth.controller.ts:219 | classe `@SkipDelegation()` + `req.user.userId \|\| .id` | user | ✅ |
| `GET /tasks/my-tasks` | tasks.controller.ts:55-56 | `@RequireRead()` (**pas** `@SkipDelegation`) + `accessibleSiteIds` | délégation-scoped | 🟡 observation mineure |

**Observation mineure :** `GET /tasks/my-tasks` requiert `X-Delegation-Id` (décorateur délégation-scoped) alors que le nom « my-tasks » laisse croire à un endpoint user-global. Pas de fuite inter-user (service filtre par `req.user.id`), mais un user MANAGE sur plusieurs délégations ne voit que les tâches de la délégation active. Ambigu — décision design à confirmer.

**Observation cohérence shape payload :** `users.controller` lit `req.user.userId`, `user-notification.controller` lit `req.user.id`. Les deux fonctionnent (JwtStrategy attache les deux alias) mais l'incohérence laisserait un consommateur typé perplexe. Non-bloquant.

**Totaux T5 :** 13 endpoints user-scoped audités · **0 violation** · 1 observation design (`/tasks/my-tasks`).

---

## Tâche 6 — Code mort backend

**Méthode :** `Grep` sur symboles suspects (`handleLegacy`, `@Resource`, `AuthProvider`, `providers-legacy`, `normalizeConnectivity`). MCP `find_references` retourne index vide sur certains symboles — fallback Grep plus fiable.

| Candidat | Lieu | Références | Verdict |
|---|---|---|---|
| `handleLegacy()` + lecture `'resource'`/`'action'` metadata | [permission.guard.ts:73-80, 107-139](backend/src/common/guards/permission.guard.ts:73) | 0 controller utilise `@Resource`/`@Action` (grep = 0) | 🟡 **code mort transitionnel v1.2→v1.3** — ~35 lignes supprimables |
| Modèle Prisma `AuthProvider` + enum `AuthProviderType` | [schema.prisma:157-175](backend/prisma/schema.prisma:157) | 0 controller, 0 service, seule la relation `Tenant.authProviders` est déclarée | 🟡 **table morte** — fonctionnalité SSO couverte par `Tenant.config.sso` JSON |
| `providers-legacy.controller.ts` | 2 endpoints `/providers` | frontend `Grep '/providers'` = 0 match | 🟡 **candidat cleanup** (maintien « backward compat » mais plus appelé) |
| `checkDelegationAccess`, `requireAdmin`, `requireAdminOrManager` | [notification.controller.ts:134-177](backend/src/modules/notifications/notification.controller.ts:134) | utilisés en interne mais logique basée sur `localRole === 'ADMIN'` qui ne peut jamais matcher (`UserDelegation.right` = MANAGE/WRITE/READ) | 🔴 **dead-code sémantique** — à refactoriser en même temps que l'ajout des décorateurs manquants (T1) |
| `mapRoleAndScopes` + `SsoDelegationEntry.role` → `delegationEntries` | oidc.strategy.ts:76 → auth.service.ts:199 | champ `role` injecté mais `syncSsoDelegations` lit `d.right` | 🔴 **dead data path** — cf. T3 |

**Totaux T6 :** **5 blocs** — 2 🟡 candidats cleanup (handleLegacy, AuthProvider model) · 1 🟡 legacy backward-compat · **2 🔴 dead-code sémantique actif** (notification auth helpers + SSO role mapping).

---

## Tâche 7 — Drift doc ↔ code (AUTH_MODEL.md §7 et §4)

**Méthode :** Prendre la table §7 `docs/architecture/AUTH_MODEL.md` comme source, pour chaque endpoint → `Grep` / `Read` pour valider existence + décorateur.

### Table de comparaison (onglet → endpoint)

| Onglet (doc) | Public doc | Endpoint doc | Endpoint réel | Décorateur réel | Drift |
|---|---|---|---|---|---|
| Profil | Tous | `/users/me/*` | `/users/me/profile`, `me/change-password` | `@SkipDelegation` | ✅ |
| Sécurité | Tous | `/auth/2fa/*`, `/users/me/change-password` | idem | `@SkipDelegation` + `@UseGuards(JwtAuthGuard)` | ✅ |
| Apparence | Tous + super admin | `/users/me/effective-appearance`, `/users/me/appearance`, `/tenants/appearance` | idem | `@SkipDelegation` + `@RequireManage` super-admin | ✅ |
| Ma délégation | MANAGE délégation | `PATCH /delegations/:id`, `POST /users`, `/user-delegations` | idem | `@RequireWrite` (×3 user-delegations) + `@RequireWrite` (PATCH delegations) | 🔴 décorateur trop laxe — doit être `@RequireManage` |
| Notifications | MANAGE | `/notification-configs/*` | `/notifications/config*` (prefix différent) | **aucun décorateur** (cf. T1) | 🔴 URL incorrecte doc + violation R1 côté code |
| Structure | SuperAdmin | `POST/DELETE /delegations` | idem | `@SkipDelegation + @RequireManage` | ✅ |
| Tenant | SuperAdmin | `PATCH /tenants/current`, `/tenants/current/config` | `PATCH /tenants/current` seulement (`/current/config` en GET uniquement) | — | 🟡 endpoint `PATCH /tenants/current/config` doc fantôme |
| SSO | SuperAdmin | `PATCH /tenants/sso-config`, `/auth-providers/*` | `PATCH /tenants/sso-config` seulement | — | 🟡 `/auth-providers/*` fantôme (cf. T4) |
| Modules | SuperAdmin | `PATCH /tenants/modules` | idem | `@RequireWrite` sur classe SkipDel+Manage → super-admin | ✅ |
| Types | SuperAdmin | `POST /admin/enum-labels`, `DELETE /admin/enum-labels/:id` | idem | classe SkipDel+Manage + `@RequireWrite`/`@RequireManage` | ✅ |
| Modèles | SuperAdmin | `POST/PATCH/DELETE /asset-models/:id` | idem | classe SkipDel + `@RequireWrite`/`@RequireManage` | ✅ |
| Électricité | SuperAdmin | `PATCH /tenants/electricity-config` | idem | `@RequireManage` | ✅ |
| Sauvegardes | SuperAdmin | `/backup/*` | idem | classe SkipDel+Manage | ✅ |

### Autres drifts AUTH_MODEL.md

| § | Texte doc | Réalité code |
|---|---|---|
| §4 | `backend/src/modules/auth/permission.guard.ts` | **vrai chemin :** [backend/src/common/guards/permission.guard.ts](backend/src/common/guards/permission.guard.ts) |
| §4 | `backend/src/modules/auth/permission.guard.ts` évoqué 1× | idem |
| §7 | `/auth-providers/*` | inexistant |
| §7 | `/notification-configs/*` | réel `/notifications/config` |
| §7 | `PATCH /tenants/current/config` | inexistant (seul GET) |

**Totaux T7 :** 13 onglets audités · **1 drift 🔴 scope** (Ma délégation) · **1 drift 🔴 URL** (Notifications) · **3 drifts 🟡 endpoint fantôme** (`/auth-providers/*`, `PATCH /tenants/current/config`, chemin permission.guard).

---

## Tâche 8 — Cohérence AccessGate UI ↔ backend

**Méthode :** `Grep "AccessGate"` frontend puis `Read` des 3 pages + AccessGate.tsx + audit/users/sites controllers.

| Page | `required` | Endpoint backend | Décorateur backend | Verdict |
|---|---|---|---|---|
| `/dashboard/admin/audit` | `super-admin` | `GET /audit` | `@SkipDelegation + @RequireManage + isSuperAdmin` check explicite | ✅ cohérent |
| `/dashboard/users` | `manage` | `GET /users` | `@RequireManage()` + scope union MANAGE | ✅ cohérent |
| `/dashboard/sites/[id]/edit` | `write` | `PATCH /sites/:id` | `@RequireWrite()` | ✅ cohérent |

Le hook `usePermissions` + [AccessGate.tsx:50-57](frontend/src/components/AccessGate.tsx:50) appliquent la logique inclusive attendue (super-admin bypass tout, MANAGE passe WRITE, etc.). Backend reste authoritatif ; l'AccessGate est strictement UX.

**Totaux T8 :** 3 pages gardées · **0 violation UX-only** · **0 faille silencieuse**. (Note : beaucoup d'autres pages pourraient bénéficier d'un AccessGate — hors scope T8.)

---

## Tâche 9 — Cohérence `PROJECT_STATUS.md` ↔ réalité code

**Méthode :** Rejeu Bash des 9 commandes de `docs/status/PROJECT_STATUS.md` § « Métriques réelles mesurées le 2026-04-19 ».

| Métrique | Doc | Mesuré | Match |
|---|---|---|---|
| Modules NestJS | 27 | 27 | ✅ |
| Prisma models | 33 | 33 | ✅ |
| Prisma enums | 18 | 18 | ✅ |
| Endpoints REST | 262 | 262 | ✅ |
| Dashboard sections | 18 | 18 | ✅ |
| Pages Next.js | 53 | 53 | ✅ |
| Composants React | 45 | 45 | ✅ |
| ADRs | 10 | 10 | ✅ |
| Dernier tag git | v1.4.0 | v1.4.0 | ✅ |

**Totaux T9 :** 9/9 métriques **fidèles à l'unité près**. PROJECT_STATUS.md § « Métriques réelles » est à jour. Les sections modules tables / textes manuels mentionnent toujours des chiffres historiques (« 10/10 modules » v1.0, « 83 policies Casbin » v1.1) dans le §v1.1.0 et § STATUT FINAL — **bas de fichier hérité** qui reste inchangé depuis v1.0/v1.1 (bien identifié par la note doc elle-même ligne 63-64). Non considéré comme drift mesuré.

---

## Plan de correctifs proposés (priorisé)

| Prio | Violation | Fix proposé | Charge estimée |
|---|---|---|---|
| 🔴 P0 | `notification.controller.ts` sans décorateurs (T1 + T6) | Ajouter décorateurs par endpoint : `@SkipDelegation()` pour routes tenant-wide + `@RequireManage()` pour config globale, `@RequireManage()` (avec DelegationGuard) pour config délégation. Supprimer `requireAdmin/requireAdminOrManager/checkDelegationAccess`. Corriger commentaires `UserDelegation.role` → `.right`. | **1h30** |
| 🔴 P0 | `monitoring-webhook.controller.ts` bloqué par JwtAuthGuard global (T1) | Ajouter `@Public()` + `@SkipDelegation()` + conserver la vérif `x-webhook-secret`. Ajouter test curl manuel. | **30 min** |
| 🔴 P0 | `user-delegations.controller.ts` élévation privilège (T4) | Remplacer `@RequireWrite()` par `@RequireManage()` sur POST/PATCH/DELETE (3 endpoints). Vérifier que les ApiOperation restent cohérents (ils disent déjà « ADMIN »). | **15 min** |
| 🟡 P1 | OIDC mapping SSO silently dropped (T3, T6) | Dans [oidc.strategy.ts:76](backend/src/modules/auth/strategies/oidc.strategy.ts:76), renommer le champ `role` → `right` et traduire ADMIN→MANAGE, MANAGER→MANAGE, TECHNICIEN→WRITE, VIEWER→READ. OU : garder `role` et accepter dans `syncSsoDelegations`. Aligner `SsoDelegationEntry` + `DEFAULT_ROLE_MAPPING`. | **1h** |
| 🟡 P1 | `PATCH /delegations/:id` trop laxe (T4, T7) | `@RequireWrite()` → `@RequireManage()` | **5 min** |
| 🟡 P2 | `handleLegacy` + legacy `@Resource/@Action` metadata | Supprimer ~35 lignes dans [permission.guard.ts:73-80, 107-139](backend/src/common/guards/permission.guard.ts:73). 0 controller n'utilise ces décorateurs legacy. | **15 min** |
| 🟡 P2 | Model Prisma `AuthProvider` + enum `AuthProviderType` morts (T6) | Supprimer du schema + `prisma db push --accept-data-loss` (dev) + migration prod. Si besoin doc historique, notifier dans ADR-009. | **30 min** |
| 🟡 P2 | AUTH_MODEL.md §7 drift (T7) | Réécrire §7 : `/auth-providers/*` → `/tenants/sso-config`; `/notification-configs/*` → `/notifications/config*`; préciser que `PATCH /tenants/current/config` n'existe pas. Corriger §4 chemin permission.guard. | **30 min** |
| 🟡 P2 | `DEVELOPMENT_GUIDE.md` + `database-schema.md` + `00-INDEX.md` Casbin présent (T2) | Ajouter un bandeau « superseded by ADR-009 — Casbin retiré en v1.3 » en tête des sections RBAC concernées. Supprimer le bloc `model CasbinRule` de `database-schema.md`. | **45 min** |
| 🟢 P3 | `providers-legacy.controller.ts` (T6) | Retirer le controller si la politique « plus de clients externes » est confirmée. Sinon conserver avec un log déprécation. | **20 min** |
| 🟢 P3 | `auth.controller POST /invite` scope confus (T1) | Clarifier : soit `@RequireManage()` sans `@SkipDelegation` pour autoriser un MANAGE local à inviter, soit mettre à jour docstring pour refléter « super-admin only ». | **15 min** |
| 🟢 P3 | `auth.controller DELETE /2fa/user/:userId` dead-check (T1) | Retirer les lignes 448-452 (vestigiales, redondantes avec `@SkipDelegation + @RequireManage`). | **5 min** |
| 🟢 P3 | Comments `notification.controller.ts:136/144/159` (T3) | Remplacer `(UserDelegation.role)` par `(UserDelegation.right)` — 3 lignes. | **2 min** |

**Charge totale estimée :** ~6h pour boucler les P0+P1+P2 (hors tests), ~40 min pour les P3.

---

## Commandes / calls utilisés (reproductibilité)

```bash
# Socle
Glob: backend/src/**/permission*.ts
Glob: backend/src/**/*.guard.ts
Read: backend/src/common/guards/{permission,delegation}.guard.ts
Read: backend/src/common/decorators/require-right.decorator.ts
Read: backend/src/app.module.ts

# T2 - Casbin
Grep "casbin|CasbinRule|newEnforcer|Enforcer" backend/src
Grep "casbin|CasbinRule|Enforcer" backend/prisma
Grep "casbin|Casbin" docs (triage par fichier)

# T3 - user.role
Grep "user\.role|\.role\s*(===?|!==?)\s*['\"](ADMIN|MANAGER|...)" backend/src
Grep "\.role\b" backend/src (triage manuel 16 matches)
Grep "^\s*role\s" backend/prisma/schema.prisma

# T1 - controllers
Grep "@(Get|Post|Patch|Put|Delete)\(" backend/src/**/*.controller.ts -C count
Grep "@(Require(Read|Write|Manage)|SkipDelegation|Public)\(" -C count
Read notification.controller.ts, user-notification.controller.ts,
     setup.controller.ts, monitoring-webhook.controller.ts, auth.controller.ts

# T5 - /me
Grep "['\"]me['\"]|['\"]me\/" backend/src/**/*.controller.ts
Read users.controller.ts, tasks.controller.ts (extract)

# T4 - super-admin
Read user-delegations.controller.ts, admin.controller.ts, tenants.controller.ts,
     asset-models.controller.ts, organization.controller.ts
Glob "backend/src/**/auth-providers*.ts" → 0 files

# T7 - drift doc
Lecture croisée AUTH_MODEL.md §4, §7, §9

# T8 - AccessGate
Grep "AccessGate" frontend/src
Read 3 pages + AccessGate.tsx + audit.controller.ts + users.controller.ts
Grep "@Patch|@Require" sites.controller.ts

# T6 - code mort
Grep "handleLegacy|@Resource|@Action|legacyResource"
Grep "AuthProvider|authProvider"
Grep "connectivity-migration|normalizeConnectivity"
Grep "providers-legacy"
Grep "['\"]\/providers['\"]|['\"]\/providers\/" frontend/src → 0
mcp__code-graph__find_references (AuthProvider/handleLegacy/requireAdmin → index vide, fallback Grep)

# T9 - métriques
bash: 9 commandes de PROJECT_STATUS.md § Métriques réelles (ls/grep/find/wc + git tag)
```

---

## Rappels opérationnels (extraits mémoire MCP)

- **`AUTO_DOC_HOOK`** : ne jamais hand-editer les timestamps / entrées auto des docs `PROJECT_STATUS.md` et `DEVELOPMENT_LOG.md` — le hook les regénère à chaque commit.
- **`DEPLOY_WORKFLOW`** : dev sur cette branche uniquement. Déploiement pilote via `ssh xch-deploy`, pas depuis ce worktree.
- **`AUTH_MODEL_V2`** : toute route sans décorateur `@Require*` ou `@SkipDelegation` + `@Public` = 403 fail-closed silencieux. C'est justement ce qui masque la casse de `notification.controller.ts`.

---

**Fin du rapport.** Décision sur priorisation et ordre d'exécution des correctifs : à toi.
