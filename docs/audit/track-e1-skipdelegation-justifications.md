# Track E.1 — `@SkipDelegation` justifications

**Date :** 2026-05-15
**Audit :** Pass 4 du Track E.1 security audit
**Source :** `grep -r '@SkipDelegation' backend/src/modules/` → 23 occurrences réparties

`@SkipDelegation()` désactive le `DelegationGuard` — la query string `X-Delegation-Id` n'est plus requise et `callerCtx.activeDelegationId` est `null` (cf. `caller-ctx.interface.ts:20`). Typiquement combiné avec `@RequireManage()` pour les opérations tenant-wide super-admin.

Chaque usage est classé par **catégorie de justification** (4 catégories).

---

## Catégorie 1 — Tenant-wide super-admin operations

L'opération concerne TOUT le tenant, pas une délégation spécifique. La délégation n'a aucun sens contextuel.

| Fichier:ligne | Endpoint(s) | Justification |
|---|---|---|
| `admin.controller.ts:32` (class) | Tous les `/admin/*` | Routes admin = gestion enum labels, settings tenant-wide |
| `audit.controller.ts:25` (method) | `/audit/*` | Audit log tenant-wide accessible super-admin only |
| `backup.controller.ts:82` (class) | Tous les `/backup/*` | Backup catalog tenant-wide (snapshot DB+MinIO = toutes les délégations) |
| `organization.controller.ts:31, 79` (methods) | `/organization/delegations/*` | Création/mise-à-jour délégations = gestion organisationnelle tenant-wide |
| `tenants.controller.ts:26` (class) | Tous les `/tenants/*` | Gestion tenant lui-même (settings appearance, etc.) |
| `users.controller.ts:132, 147, 156, 168, 183, 192, 204` (methods × 7) | `/users/*` super-admin operations | Création users, gestion super-admin status, delete users — tenant-wide |

**Total catégorie 1 :** 13 usages

---

## Catégorie 2 — Pre-delegation flows

L'utilisateur n'a pas encore de délégation OU l'opération précède le choix de délégation.

| Fichier:ligne | Endpoint(s) | Justification |
|---|---|---|
| `auth.controller.ts:54` (class) | `/auth/*` login, /me, /profile | Auth = login/refresh/profile self-scoped, antérieur au choix de délégation |
| `setup.controller.ts:28` (class) | `/setup/*` | Setup wizard = installation initiale, AVANT existence d'une délégation |

**Total catégorie 2 :** 2 usages

---

## Catégorie 3 — Self-scoped operations (delegation orthogonal)

L'opération porte sur les données propres à l'utilisateur connecté. La délégation n'a pas de pertinence contextuelle.

| Fichier:ligne | Endpoint(s) | Justification |
|---|---|---|
| `notifications/notification.controller.ts:71, 177` (methods) | `/notifications/me/*` | Feed notifications de l'utilisateur connecté |
| `notifications/user-notification.controller.ts:33` (class) | `/user-notifications/*` | Préférences notifications self-scoped |
| `user-delegations.controller.ts:67` (method) | `/user-delegations/me` | Liste des délégations DU CALLER (méta — pas dans une délégation) |

**Total catégorie 3 :** 4 usages

---

## Catégorie 4 — Reference data / tenant catalog

Données catalogue partagées par toutes les délégations du tenant — délégation orthogonale.

| Fichier:ligne | Endpoint(s) | Justification |
|---|---|---|
| `asset-models.controller.ts:34` (class) | `/asset-models/*` | Catalogue des modèles d'assets (Cisco, Fortinet, etc.) partagé tenant-wide |

**Total catégorie 4 :** 1 usage

---

## Catégorie 5 — Dev / test only

Endpoints gated par env flag, jamais exposés en prod.

| Fichier:ligne | Endpoint(s) | Justification |
|---|---|---|
| `seed.controller.ts:29` (class) | `/seed/*` | Dev seed data — gated `NODE_ENV !== 'production'` |
| `test-error.controller.ts:61, 93` (methods) | `/test-error/*` | GlitchTip test error injection — dev only |

**Total catégorie 5 :** 3 usages

---

## Total

| Catégorie | Usages | % |
|---|---|---|
| 1. Tenant-wide super-admin | 13 | 57% |
| 2. Pre-delegation flows | 2 | 9% |
| 3. Self-scoped (delegation orthogonal) | 4 | 17% |
| 4. Reference data / tenant catalog | 1 | 4% |
| 5. Dev / test only | 3 | 13% |
| **TOTAL** | **23** | **100%** |

**Conclusion** : 23/23 `@SkipDelegation` usages **systémiquement justifiés**. Aucun suspect, aucun à supprimer. Discipline RBAC 100%.

---

## Recommandation

Documenter cette taxonomie dans le code source via un **commentaire de classe** sur chaque `@SkipDelegation()` controller, du type :

```ts
/**
 * @SkipDelegation — Catégorie 1 (tenant-wide super-admin) :
 * gestion users = scope organisation, pas une délégation spécifique.
 */
@SkipDelegation()
@RequireManage()
@Controller('users')
export class UsersController { ... }
```

À planifier Track E.4 (mini-cleanup PR — pure docs, 0 risque). Aide reviewers + audits futurs.
