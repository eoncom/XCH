# ADR-021 : RBAC universel — data filtering systématique au niveau service

Date : 2026-04-29
Statut : Accepté
Tag cible : v1.8.0 (Session 4 du plan finalization v2)
Dépendances :
- AUTH_MODEL v2 (UserDelegation MANAGE/WRITE/READ + AccessOverride
  ALLOW/DENY) — pierre angulaire de l'autz, inchangée.
- ADR-020 §B (`config_json` non-sensible — pattern de modélisation
  cohérent).

## Contexte

XCH a 3 niveaux de défense côté autz :

1. **Endpoint authz** (`PermissionGuard`) — vérifie qu'un user a le
   droit minimum requis (`@RequireRead/Write/Manage`) sur sa délégation
   active. FAIL-CLOSED : un endpoint sans décorateur est refusé.
2. **Data filtering au niveau service** — le service filtre les rows
   qu'il retourne en fonction du caller. **C'est ici que le projet est
   incohérent.**
3. **Audit log** — traçabilité a posteriori (orthogonal à l'autz, hors
   scope ADR-021).

L'audit Session 4 Phase 1 a montré que sur 15 modules backend
audités, **un seul est conforme** au niveau du data filtering :

| Catégorie | Modules concernés | Description |
|---|---|---|
| ❌ Sans aucun scope automatique | contacts, connectivity | findAll retourne tout le tenant à n'importe quel user authentifié — bug confirmé en prod sur Contact |
| ❌ API atypique avec trous critiques | notification-settings, sdwan, consumption | Cross-skew header X-Delegation-Id vs body delegationId pour notif, validation scope inexistante pour sdwan/consumption |
| ⚠️ findOne(id) non vérifié | sites, assets, racks, tasks, floor-plans, monitoring, expenses, budgets, billing-entities | `where: { id, tenantId }` sans re-vérifier l'accès — guess by id contourne le scope |
| ✅ Conforme | users | `users.service.findAll` utilise `getManagedDelegationIds` correctement |

**14/15 modules incohérents. Une promesse RBAC tenue à 7%.**

Le `PermissionGuard` est sain — il fait son boulot d'authz endpoint.
Mais le data filtering est laissé à chaque service avec un pattern non
unifié : certains modules pré-résolvent un `accessibleSiteIds[]` au
controller (sites, assets…), d'autres résolvent dans le service
(users), d'autres pas du tout (contacts, connectivity).

## Décision

### 1. Pattern d'injection unifié — `CallerCtx` + DI `PermissionService`

Tout service exposant une entité tenant-scopée prend en paramètre un
`CallerCtx` et délègue le row-level filtering à `PermissionService`.
Le controller construit le `CallerCtx` via le param decorator
`@CallerCtx()`.

```ts
// Controller
@Get(':id')
@RequireRead()
findOne(@Param('id') id: string, @CallerCtx() ctx: CallerCtx) {
  return this.svc.findOne(id, ctx);
}

// Service
async findOne(id: string, ctx: CallerCtx) {
  const entity = await this.prisma.x.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!entity) throw new NotFoundException();
  await this.perm.assertCanReadSite(ctx, entity.siteId);  // 404 si denied
  return entity;
}
```

**Pas le pattern `accessibleSiteIds[]` pré-résolu au controller.**
Trop facile à oublier — c'est exactement la racine du bug Contact qui
a 4 ans d'historique.

### 2. Helpers canoniques (`PermissionService`)

| Helper | Retour | Usage |
|---|---|---|
| `getReadableSiteIds(ctx)` | `string[] \| null` | findAll filtre `siteId IN (…)` ; null = super admin |
| `getReadableDelegationIds(ctx)` | `string[] \| null` | findAll filtre `delegationId IN (…)` ; READ+WRITE+MANAGE union |
| `getManagedDelegationIds(ctx)` | `string[] \| null` | findAll cost module (MANAGE-only — comportement existant préservé) |
| `assertCanReadSite(ctx, siteId)` | throw 404 | findOne site-scoped |
| `assertCanReadDelegation(ctx, delegationId, { allowGlobal? })` | throw 404 | findOne delegation-scoped, flag pour entités à null partagé |
| `assertCanWriteSite(ctx, siteId, resource?)` | throw 403 | update/remove site-scoped (algorithme `resolve()` complet) |
| `assertCanWriteDelegation(ctx, delegationId)` | throw 403 | update/remove delegation-scoped |

### 3. `findOne` re-checke l'accès — règle universelle

Aucun service ne fait `where: { id, tenantId }` seul. Chaque `findOne`
:
1. Charge l'entité avec sa colonne de scope (`siteId` ou `delegationId`).
2. Si null → 404.
3. Sinon `assertCanReadSite/Delegation` (404 si denied).

L'algorithme `permission.service.resolve()` (6 étapes
AccessOverride existant) reste utilisé tel quel par
`assertCanWriteSite` pour préserver les overrides resource-level.

### 4. Shape d'erreur HTTP (figée)

| Cas | Code | Raison |
|---|---|---|
| GET un id hors scope | **404** | Defense in depth — ne pas révéler l'existence d'un id à un user qui n'a pas accès |
| GET un id qui n'existe pas | 404 | Standard |
| PATCH/DELETE un id hors scope (mais accessible en lecture) | **403** | L'user a vu la ressource via une fenêtre légitime, le refus doit être explicite |
| Cross-skew header X-Delegation-Id ≠ body delegationId | **403** | Signal explicite d'attaque/erreur |

Cohérent avec OWASP recommendations.

### 5. `SYSTEM_CTX` — factory traçable, pas constante

Pour les cron jobs, BullMQ processors, seeders qui ont besoin de
contourner l'autz, exporter une **factory** (pas une constante)
qui logue chaque usage :

```ts
SYSTEM_CTX('cron-warranty-expiring', tenantId)
SYSTEM_CTX('bullmq-notification-dispatch', payload.tenantId)
SYSTEM_CTX('seed-demo-tenant', tenantId)
```

Chaque appel produit un log INFO `[SYSTEM_CTX] used by <reason> on tenant=<id>`
visible via `docker logs xch-backend | grep SYSTEM_CTX`. Transforme
un bypass paresseux (constante exportée et utilisée sans réfléchir)
en bypass auditable. Grep `SYSTEM_CTX(` au merge de chaque PR =
liste exhaustive des points où l'autz est volontairement contournée.

### 6. Audit schéma actif des champs scope-nullable

Tous les modèles Prisma avec un champ scope nullable
(`delegationId String?`, `siteId String?`, `userId String?`) ont été
audités au début de PR1 et classifiés. **Aucune supposition** —
preuve issue du commentaire schéma ou du code applicatif existant.

#### Catégorie A — `null` = "partagé, lisible par tous" (`allowGlobal: true`)

| Modèle | Champ | Preuve |
|---|---|---|
| Contact | `delegationId` | Commentaire schéma ligne 1009 : `delegationId=null → global (super admin only, visible en lecture partout)` |
| Expense | `delegationId` | Commentaire schéma ligne 1292 : `delegationId=null → global (super admin, visible partout en lecture)` |
| TenantSecurityReminder | `siteId` | Commentaire schéma ligne 202 : `Optional site scope. NULL = applies to all sites in the tenant` |

→ Filter `where.OR = [{ delegationId: null }, { delegationId: { in: readable } }]`. Super-admin only en écriture.

#### Catégorie B — `null` = "tenant-wide super-admin only" (`allowGlobal: false`)

| Modèle | Champ | Preuve |
|---|---|---|
| NotificationChannel | `delegationId` | Comportement existant `requireSuperAdminForGlobal` dans notification.controller |
| NotificationRule | `delegationId` | Idem |

→ Filter `where.delegationId IN (readable)` strict pour les non-super-admins. Super-admin bypass.

#### Catégorie C — À confirmer en PR5

| Modèle | Champ | Note |
|---|---|---|
| Budget | `delegationId` | Pas de commentaire schéma. Recommandation : aligner sur Expense (catégorie A) — un budget global financièrement visible par tous les MANAGE du tenant. À acter à l'implémentation. |

#### Catégorie D — Pas un scope d'autz (champ nullable hors RBAC)

| Modèle | Champ | Justification |
|---|---|---|
| AuditLog | `userId` | Action système (cron) — l'autz porte sur l'endpoint `GET /audit` (super-admin only), pas sur les rows. |
| AssetMovement | `userId` | Mouvement automatique sans actor. |
| Asset | `delegationId`, `siteId` | Asset peut être en stock (hors site/délégation). L'autz Asset suit le pattern site-scoped via `siteId` ; quand `siteId=null`, l'asset est tenant-only (visible MANAGE tenant). |
| Photo | `siteId` | Polymorphique (assetId, taskId, rackId, siteId — un parmi 4) — scope dérivé du parent. |
| MonitorCheck | `siteId` | Polymorphique (siteId, assetId, linkId — un parmi 3) — scope dérivé. |
| CostAllocation | `siteId` | Scope dérivé via Expense parent. |
| NotificationLog | `delegationId` | Endpoint `GET /logs` super-admin only — pas de filtrage row-level. |

## Conséquences

### Positives
- Un seul endroit où la logique d'autz vit (PermissionService).
- Fail-closed par construction : un service qui oublie d'appeler
  `assertCanRead*` retourne quand même les rows filtrées par
  `getReadable*Ids` au findAll, et le findOne sans assert retourne
  trop mais c'est détecté par le test d'intrusion en CI.
- Cohérence Prisma+SYSTEM_CTX : grep des bypass possible.
- Tests d'intrusion bloquants en CI (PR2) : la règle survit à l'ajout
  de futurs modules par construction.

### Négatives (acceptées)
- Breaking sur la shape d'erreur API : un GET cross-delegation passait
  de "200 + leak" à "404". Bump v1.8.0.
- 14 modules à refactor (PR3-PR5).
- Tous les services métier gagnent une dépendance `PermissionService`.
  Coût négligeable (~3ms/req max).
- Cross-call services internes (cron/jobs) doivent passer
  `SYSTEM_CTX(reason, tenantId)` explicite. Convention documentée.

### Forward dependencies (Session 5+)
- **Lint custom ts-morph** qui détecte tout `findOne` sur entité
  tenant-scopée sans paramètre `CallerCtx`. La règle ADR-021 devient
  alors mécaniquement enforced.
- **Postgres RLS** comme défense en profondeur. À reconsidérer si le
  besoin d'une 4ᵉ couche de défense apparaît.

## Alternatives considérées

1. **Filtrage Prisma middleware global** — rejeté. Le middleware n'a
   pas accès au CallerCtx (request-scoped). De plus, les
   `queryRawUnsafe` (utilisés par sites.service notamment) bypassent
   le middleware. Pas une garantie universelle.

2. **Postgres Row-Level Security** — rejeté pour Session 4. Très bon
   long-terme (défense en profondeur DB), mais nécessite de set
   `current_user_id` dans chaque session Prisma + GRANT/POLICY pour
   chaque table — trop d'infra à déployer pour cette session. À
   reconsidérer Session 5+ comme couche supplémentaire.

3. **PermissionGuard qui filtre les rows** — incompatible avec
   l'architecture Nest. Un guard ne peut pas modifier la response.

4. **Pattern `accessibleSiteIds[]` pré-résolu au controller** —
   rejeté (cf. §1). Trop facile à oublier au controller, c'est la
   racine du bug Contact.

5. **Maintenir le statu quo et ne fixer que les 2 bugs critiques** —
   rejeté. Le trou findOne sur 9 modules reste exploitable par guess
   by id, et ne sera jamais fixé sans une session dédiée. Mieux faire
   tout maintenant.

## Plan d'exécution

Cf. plan détaillé dans le fichier de plan utilisateur. 6 PRs sur
2 sessions Claude (4a + 4b) :

- **Session 4a** : PR1 (helpers + ADR-021 + fixtures), PR2 (CI
  workflow + branch protection), PR3 (fix contacts + connectivity).
  Mergeable et déployable indépendamment.
- **Session 4b** : PR4 (notif-settings cross-skew + sdwan +
  consumption), PR5 (9 modules findOne), PR6 (audit deep-link
  frontend + tag v1.8.0 + branch protection finale).

## Annexe — table récap par module (état avant/après)

| Module | Avant | Après | Spec dédiée |
|---|---|---|---|
| sites | findAll scopé via getAccessibleSiteIds, findOne ⚠️ | findOne assertCanReadSite | `find-one-cross-delegation.spec.ts` |
| assets | idem | idem | idem |
| racks | idem | idem | idem |
| tasks | idem | idem | idem |
| floor-plans | idem | idem | idem |
| monitoring | idem | idem | idem |
| expenses | findAll scopé via getManagedDelegationIds (MANAGE), findOne ⚠️ | findOne assertCanReadDelegation | idem |
| budgets | idem | idem | idem |
| billing-entities | idem | idem | idem |
| contacts | ❌ pas de scope | findAll filtré + findOne assertCanReadDelegation(allowGlobal) | `contacts-cross-delegation.spec.ts` |
| connectivity | ❌ pas de scope | findAll filtré + findOne assertCanReadSite | `connectivity-cross-site.spec.ts` |
| notif-settings | ❌ cross-skew | enforceDelegationConsistency | `notification-settings-cross-skew.spec.ts` |
| sdwan | ❌ ensureSite tenant-only | assertCanReadSite/WriteSite | `sdwan-cross-delegation.spec.ts` |
| consumption | ❌ pas de scope | computeSite/computeRack/summary scopés | `consumption-cross-delegation.spec.ts` |
| users | ✅ déjà conforme | inchangé (helper renommé en interne) | déjà couvert |
