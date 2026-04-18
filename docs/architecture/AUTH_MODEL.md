# Modèle d'autorisation XCH (v2)

> **Objet** : document de référence pour tout IA dev / agent travaillant sur XCH.
> **Usage** : à relire en début de session si tu touches aux permissions, aux guards, ou aux users.
> **Statut** : Casbin retiré, `User.role` déprécié. La vérité vient de `UserDelegation` + `AccessGrant` + `isSuperAdmin`.

---

## TL;DR (en 30 secondes)

1. Un utilisateur **n'a pas de rôle global**. Il a des `UserDelegation` qui lui donnent une permission (`READ` / `WRITE` / `MANAGE`) **sur une délégation spécifique**.
2. `MANAGE` est le niveau admin **local** (limité à la/les délégation(s) où l'user a ce niveau).
3. `isSuperAdmin` est un flag **global** (bypass total, voit et modifie tout le tenant).
4. `AccessGrant` (ALLOW/DENY) permet d'élever ou restreindre l'accès **par site précis**.

---

## 1. Les 3 niveaux de permission (scope = délégation)

Permissions **hiérarchiques** : `MANAGE` inclut `WRITE` inclut `READ`.

| Niveau | Ce que l'user peut faire sur la délégation |
|--------|----------------------------------------------|
| **READ** | Lire les entités (assets, sites, tâches...). Pas de modification. |
| **WRITE** | READ + créer, modifier, supprimer ses propres entités. |
| **MANAGE** | WRITE + inviter/retirer des users, configurer la délégation, gérer les permissions locales. ⚠️ **Limité à la délégation** où l'user a ce rôle. |

### Oui, MANAGE = administrateur… mais **local**

`MANAGE` = administrateur **de sa délégation uniquement**. Il peut :
- Ajouter/retirer des users **dans sa délégation**
- Leur attribuer READ/WRITE/MANAGE **dans sa délégation**
- Modifier la config de **sa délégation**

Il **ne peut pas** :
- Voir ou toucher les autres délégations du tenant
- Modifier les settings globaux du tenant
- Créer d'autres délégations
- Gérer les `EnumLabel` globaux
- Toucher aux `AuthProvider` (SSO, etc.)

---

## 2. `isSuperAdmin` — le vrai admin global

Flag booléen sur `User` (champ `isSuperAdmin: Boolean @default(false)`).

Différence fondamentale avec `MANAGE` :

|  | `MANAGE` (sur délégation X) | `isSuperAdmin` |
|---|---|---|
| Scope | Une seule délégation | Tout le tenant |
| Voit les autres délégations | ❌ Non | ✅ Oui |
| Crée des délégations | ❌ Non | ✅ Oui |
| Gère les EnumLabel globaux | ❌ Non | ✅ Oui |
| Gère les AuthProvider / SSO | ❌ Non | ✅ Oui |
| Bypass PermissionGuard | ❌ Non | ✅ Oui (shortcut en tête de garde) |
| Peut créer un autre SuperAdmin | ❌ Non | ✅ Oui |
| Invité comment ? | Par un MANAGE ou SuperAdmin | Uniquement par un autre SuperAdmin |

**Règle mentale** : `isSuperAdmin` = "owner du tenant". `MANAGE` = "chef de délégation".

---

## 3. `AccessGrant` — surcharges fines par site

Permet de dévier du rôle hérité de la délégation **pour un site précis**.

```prisma
model AccessGrant {
  userId        String
  delegationId  String
  siteId        String?         // null = applique à toute la délégation
  type          AccessGrantType // ALLOW | DENY
  permission    Permission?     // READ | WRITE | MANAGE (si ALLOW)
}
```

### Cas d'usage

| Scénario | Configuration |
|---|---|
| User WRITE sur délégation Paris, mais **pas** accès au site "Chantier sensible" | `AccessGrant(userId, delegationId=Paris, siteId=Sensible, type=DENY)` |
| User READ sur délégation Lyon, mais MANAGE sur le site "Datacenter-Lyon-1" | `AccessGrant(userId, delegationId=Lyon, siteId=DC1, type=ALLOW, permission=MANAGE)` |
| User externe uniquement sur un site | Pas de `UserDelegation` + `AccessGrant(ALLOW, READ)` ciblé site |

### Résolution (dans l'ordre)

1. `isSuperAdmin` → accès à tout, fin.
2. `AccessGrant(DENY)` sur le site → refusé, fin.
3. `AccessGrant(ALLOW, permission=X)` sur le site → permission X.
4. `UserDelegation.permission` sur la délégation parente → permission par défaut.
5. Rien → **403**.

---

## 4. Implémentation backend (NestJS)

### Décorateurs fail-closed (à mettre sur CHAQUE endpoint)

```ts
@RequireRead('assets')    // GET endpoints
@RequireWrite('assets')   // POST / PATCH / DELETE sur entités métier
@RequireManage('assets')  // actions d'admin (purge, config, invites)
@SkipDelegation()         // endpoints user-scoped (/notifications/me, /auth/me)
```

⚠️ **Un controller sans décorateur = endpoint bloqué par défaut** (fail-closed). C'est voulu.

### `PermissionGuard` (global, dans `app.module.ts`)

Ordre de vérification :
```
if (user.isSuperAdmin) → ALLOW
if (@SkipDelegation)   → ALLOW (mais JWT requis)
else:
  résoudre permission effective (UserDelegation + AccessGrant sur la ressource)
  if permission >= requiredLevel → ALLOW
  else → 403
```

Fichiers clés :
- `backend/src/modules/auth/permission.guard.ts` — la garde
- `backend/src/common/services/permission.service.ts` — résolution effective
- `backend/src/common/decorators/require-right.decorator.ts` — les décorateurs

---

## 5. Côté frontend

Hook `usePermissions()` dans `frontend/src/hooks/usePermissions.ts` :

```ts
const {
  canCreate,         // (resource) => boolean — équivalent WRITE
  canUpdate,         // (resource) => boolean — équivalent WRITE
  canDelete,         // (resource) => boolean — équivalent WRITE (sauf entités critiques → MANAGE)
  isManagerOrAbove,  // boolean — a MANAGE sur au moins une délégation
  isSuperAdmin,      // boolean — flag global
} = usePermissions();
```

Appelle `GET /api/auth/my-permissions` qui retourne la permission effective calculée côté backend, puis applique les règles UI.

---

## 6. Checklist d'alignement (à faire valider par l'IA dev)

Lis ce document puis confirme chacun des points :

- [ ] `MANAGE` ≠ `SuperAdmin`. MANAGE est **local** à une délégation.
- [ ] Un user peut avoir `MANAGE` sur une délégation et `READ` sur une autre.
- [ ] `isSuperAdmin` bypasse le `PermissionGuard` en première ligne.
- [ ] `User.role` (enum ADMIN/MANAGER/TECHNICIEN/VIEWER) est **déprécié** — ne jamais l'utiliser pour autoriser.
- [ ] Casbin a été retiré — ne pas réintroduire.
- [ ] Tout nouveau controller endpoint **doit** avoir `@RequireRead/@RequireWrite/@RequireManage` ou `@SkipDelegation`.
- [ ] `AccessGrant(DENY)` prime sur `UserDelegation` — utile pour black-lister un site.
- [ ] Seul un `SuperAdmin` peut en créer un autre.
- [ ] Les endpoints user-scoped (`/me`, `/my-*`) utilisent `@SkipDelegation()` + filtrent par `req.user.userId`.
- [ ] Côté frontend, on s'appuie sur `usePermissions()`, jamais sur `user.role`.

---

## 7. Mapping UI : onglets Paramètres

Matrice de visibilité des onglets de `/dashboard/settings` par rôle effectif :

| Onglet | Public | Endpoints dérivés | Portée |
|---|---|---|---|
| Profil | Tous (authentifié) | `/users/me/*` | 👤 personnel |
| Sécurité | Tous | `/auth/2fa/*`, `/users/me/change-password` | 👤 personnel |
| Apparence | Tous | n/a (client) | 👤 personnel |
| **Ma délégation** | `MANAGE` sur la délégation active (non super admin) | `PATCH /delegations/:id`, `POST /users`, `/user-delegations` | 🏢 délégation |
| Notifications | `MANAGE` sur délégation OU super admin | `/notification-configs/*` | 🏢 délégation |
| **Structure** | 🛡 SuperAdmin uniquement | `POST /delegations`, `DELETE /delegations/:id` | 🌐 tenant |
| **Tenant** | 🛡 SuperAdmin | `PATCH /tenants/current`, `/tenants/current/config` | 🌐 tenant |
| **SSO** | 🛡 SuperAdmin | `PATCH /tenants/sso-config`, `/auth-providers/*` | 🌐 tenant |
| **Modules** | 🛡 SuperAdmin | `PATCH /tenants/modules` | 🌐 tenant |
| **Types** (EnumLabel) | 🛡 SuperAdmin | `POST /admin/enum-labels`, `DELETE /admin/enum-labels/:id` | 🌐 tenant |
| **Modèles** (AssetModel) | 🛡 SuperAdmin | `POST /asset-models`, `PATCH /asset-models/:id`, `DELETE /asset-models/:id` | 🌐 tenant (catalogue) |
| **Électricité** | 🛡 SuperAdmin | `PATCH /tenants/electricity-config` | 🌐 tenant |
| **Sauvegardes** | 🛡 SuperAdmin | `/backup/*` | 🌐 tenant |

Les onglets **globaux** sont masqués aux utilisateurs `MANAGE` pour ne laisser voir que ce sur quoi ils ont autorité. Le backend applique la même règle via `@SkipDelegation() + @RequireManage()` ou `+ @RequireWrite()` (super admin only, cf. `PermissionGuard`).

### Pattern d'endpoint

| Besoin | Décorateurs |
|---|---|
| Lecture globale (ex: liste AssetModel pour autocomplete) | `@SkipDelegation() + @RequireRead()` — passe pour tout authentifié |
| Action globale (ex: créer un EnumLabel, un AuthProvider) | `@SkipDelegation() + @RequireWrite()` ou `@RequireManage()` — super admin only |
| Action sur délégation propre | `@RequireWrite()` ou `@RequireManage()` (sans `@SkipDelegation`) — vérifie `UserDelegation.right` via `DelegationGuard` |
| Route user-scoped (`/me`, `/my-*`) | `@SkipDelegation()` — tout authentifié, filtre par `req.user.userId` |

---

## 8. Pièges fréquents

| Piège | Solution |
|---|---|
| Oubli du décorateur `@RequireX` → endpoint renvoie 403 mystérieux | Ajouter le décorateur approprié ou `@SkipDelegation` |
| Tester avec l'user `admin@demo.fr` (SuperAdmin) qui passe tout | Tester aussi avec `manager@demo.fr` et `technicien@demo.fr` (tous `demo123`) |
| Chercher `user.role === 'ADMIN'` en backend | Utiliser `user.isSuperAdmin` ou `PermissionService.effectivePermission()` |
| Nouveau module sans `@RequireRead` sur le GET list | Toujours commencer par écrire les décorateurs avant le contrôleur |
| `AccessGrant` sans `delegationId` | Le champ est requis, même pour une grant site-only |

---

## 9. Historique (pour contexte)

- **v1.0 → v1.1** : Casbin + `User.role` enum — trop rigide, deux sources de vérité.
- **v1.2** : delegation-first, introduction de `UserDelegation` + `AccessGrant`, `User.role` marqué deprecated.
- **v1.3** : Casbin définitivement retiré (module `casbin/` supprimé, `casbinRule` table vide), `PermissionGuard` fail-closed, décorateurs obligatoires.

---

**Fichiers à lire si tu dois toucher l'auth** :
1. `backend/prisma/schema.prisma` — sections `User`, `UserDelegation`, `AccessGrant`, `Delegation`, `Permission` enum
2. `backend/src/modules/auth/permission.guard.ts`
3. `backend/src/common/services/permission.service.ts`
4. `backend/src/common/decorators/require-right.decorator.ts`
5. `frontend/src/hooks/usePermissions.ts`
