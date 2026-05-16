# ADR-028 — AuditLog enrichment + `@SkipDelegation` taxonomy

Date : 2026-05-15
Statut : Accepté
Tag cible : v2.4.x (Track E.4 audit log enrichment) — pattern figé immédiat, implémentation différée
Dépendances :
- [ADR-021](adr-021-rbac-universal-data-filtering.md) — couvre déjà multi-tenant lookup discipline + 404/403 shape figée
- MCP `XCH_BOLA_PATTERN_CHECK` — pattern cross-tenant 404 pour writes sans read access (ne pas leak existence)
- MCP `XCH_DEMO_DATA_PRINCIPLE` — migrations destructives autorisées (pas de précautions zero-downtime/backfill sur xch-deploy)
- MCP `XCH_ENGINEERING_PRINCIPLES` — règles de l'art, pas de dette, fail-closed décorateurs

## Contexte

Track E.1 (security audit, 2026-05-15) a vérifié l'alignement code vs ADRs et identifié **2 gaps non couverts par les ADRs existants** :

### Gap 1 — `@SkipDelegation` taxonomy

ADR-021 §5 documente `SYSTEM_CTX` (factory traçable pour cron/processors qui contournent l'autz). Mais le décorateur `@SkipDelegation()` appliqué aux endpoints utilisateurs n'a pas de taxonomy figée.

Audit Pass 4 Track E.1 a inventorié **23 usages** dans 14 controllers, et a empiriquement validé qu'ils tombent dans 5 catégories systémiquement justifiées. **La taxonomy doit être figée pour empêcher la dérive future** (ajout `@SkipDelegation()` non justifié par un reviewer pressé).

### Gap 2 — AuditLog enrichment

ADR-021 §6 catégorie D justifie `userId` nullable dans `auditLog` (actions système). Mais le schéma audit_log a **3 gaps de capture** :
- `ipAddress` : colonne présente, **0 caller production ne la populent** (toujours NULL en prod)
- `userAgent` : colonne présente, **0 caller production ne la populent** (toujours NULL en prod)
- `delegationId` : **colonne absente** du schéma Prisma

Pour un déploiement air-gap avec threat model "insider", la traçabilité IP source + UA + délégation est critique pour audit forensique post-incident. **Pattern de capture à figer** : interceptor global qui enrichit chaque `auditLogService.log()` avec le contexte requête.

## Décision

### Partie A — `@SkipDelegation` taxonomy figée

Tout nouveau `@SkipDelegation()` controller-level OU method-level **DOIT** tomber dans une des 5 catégories suivantes, documenté en commentaire JSDoc immédiatement au-dessus du décorateur.

#### Catégorie 1 — Tenant-wide super-admin operations

L'opération concerne **tout le tenant** (pas une délégation spécifique). La délégation n'a aucun sens contextuel.

Exemples figés :
- `admin.controller`, `audit.controller`, `backup.controller`, `tenants.controller` (class-level)
- `users.controller` méthodes super-admin (création users, gestion `isSuperAdmin`, delete)
- `organization.controller` création/update délégations

#### Catégorie 2 — Pre-delegation flows

L'utilisateur n'a **pas encore** de délégation active OU l'opération précède le choix de délégation.

Exemples figés :
- `auth.controller` (class-level) — login/refresh/profile self-scoped
- `setup.controller` (class-level) — wizard installation initiale

#### Catégorie 3 — Self-scoped operations (delegation orthogonal)

L'opération porte sur les données **propres au caller**. La délégation n'a pas de pertinence contextuelle.

Exemples figés :
- `notifications/notification.controller` méthodes `me/*` (feed notifications du caller)
- `user-notification.controller` (préférences notifications self-scoped)
- `user-delegations.controller` méthode `me` (liste des délégations DU caller)

#### Catégorie 4 — Reference data / tenant catalog

Données **catalogue partagées** par toutes les délégations du tenant — délégation orthogonale.

Exemples figés :
- `asset-models.controller` (class-level) — catalogue vendor models (Cisco/Fortinet/etc.) partagé tenant-wide

#### Catégorie 5 — Dev / test only

Endpoints **gated par env flag** (`NODE_ENV !== 'production'`), jamais exposés en prod.

Exemples figés :
- `seed.controller` (class-level) — dev seed data
- `test-error.controller` méthodes — GlitchTip test error injection

#### Pattern d'annotation JSDoc obligatoire

```ts
/**
 * @SkipDelegation — Catégorie 1 (tenant-wide super-admin) :
 * gestion users = scope organisation, pas une délégation spécifique.
 * Cf. ADR-028.
 */
@SkipDelegation()
@RequireManage()
@Controller('users')
export class UsersController { ... }
```

#### Catch-all

**Un `@SkipDelegation()` non classifié dans une des 5 catégories est interdit par convention.** Un reviewer doit refuser le PR. Pas de check CI automatique pour MVP (manuel review).

### Partie B — AuditLog enrichment

#### B.0 — Nullability taxonomy figée pour `audit_log.delegationId`

**Ajout 2026-05-16 (sub-pass 1.B.-1 Track E.4)** : application explicite de la discipline nullability `delegationId` au cas spécifique `audit_log.delegationId`, dérivée de la combinaison ADRs existants. **Pas de contradictions inter-ADRs**, mais cartographie 5 cat @SkipDelegation ↔ nullability `audit_log.delegationId` non explicite avant cette section.

**Verdict audit ADR 5-niveaux (sub-pass 1.B.-1)** : la discipline générale est figée implicitement par 4 sources convergentes — `audit_log.delegationId` hérite donc directement de cette discipline, formalisée ici pour le cas audit log.

##### Sources de la discipline figée (lecture inter-ADRs)

| Source | Contribution |
|---|---|
| [ADR-009](adr-009-delegation-first-model.md) "Rattachement par entité" | Pattern général : `delegationId` nullable ⇔ "global super-admin only" sur entités métier (Contact / BillingEntity / NotificationConfig). Règle cohérence : si `delegationId=null` alors action super-admin. |
| [ADR-021 §6](adr-021-rbac-universal-data-filtering.md) catégorie D "Pas un scope d'autz" | Fige explicitement `audit_log.userId` nullable (actions système cron). **Extension cohérente à `audit_log.delegationId`** : nullable légitime pour actions tenant-wide / système, pas un scope d'autz row-level. |
| [`caller-ctx.interface.ts:21`](../../backend/src/common/types/caller-ctx.interface.ts:21) | Pattern figé : `activeDelegationId: string \| null` avec commentaire "null on @SkipDelegation routes". Source canonique de la propagation. |
| [`SYSTEM_CTX`](../../backend/src/common/types/caller-ctx.interface.ts:45) (cron/BullMQ/seed) | Force `activeDelegationId: null` systématiquement (forcé par construction). Aligne avec ADR-021 §6 cat D. |
| [`AuditLogEntry` actuel](../../backend/src/common/services/audit-log.service.ts:4) | Pattern existant `userId?` / `ipAddress?` / `userAgent?` — nullable systématique. Extension `delegationId?` cohérente. |

##### Cartographie 1:1 catégorie `@SkipDelegation` ↔ nullability `audit_log.delegationId`

Application de la partie A (5 catégories `@SkipDelegation`) à la nullability `audit_log.delegationId` :

| Cat | Endpoints type | `activeDelegationId` request-time | `audit_log.delegationId` attendu |
|---|---|---|---|
| **Cat 1 — Tenant-wide super-admin** (`admin`, `audit`, `backup`, `tenants`, `users` super-admin, `organization` CRUD délégations) | `X-Delegation-Id` absent OU ignoré, super-admin opère tenant-wide | `null` | **`null` LÉGITIME** (action tenant-wide, pas de scope délégation) |
| **Cat 2 — Pre-delegation** (`auth`, `setup`) | Pré-authent, pas de header délégation | `null` | **`null` LÉGITIME** (avant choix délégation) |
| **Cat 3 — Self-scoped** (`notification` me/*, `user-notification`, `user-delegations` me) | Header `X-Delegation-Id` **peut être présent** (UI a sélectionné une délégation active même si l'endpoint ne l'utilise pas pour scope) | **null OU non-null** selon arbitrage Option A/B (voir §B.0.2) | **arbitrage Option A capture / Option B null par convention** |
| **Cat 4 — Reference data / catalog** (`asset-models`) | Header `X-Delegation-Id` peut être présent | **null OU non-null** selon arbitrage Option A/B (voir §B.0.2) | **arbitrage Option A capture / Option B null par convention** |
| **Cat 5 — Dev/test only** (`seed`, `test-error`, gated `NODE_ENV !== 'production'`) | Gated env, contexte dev | `null` typique | **`null` LÉGITIME** (jamais en prod) |
| **SYSTEM_CTX** (cron / BullMQ / seed scripts) | Forcé par construction | `null` toujours | **`null` LÉGITIME** (per ADR-021 §6 cat D + `caller-ctx.interface.ts:55`) |
| **Endpoints délégation-scoped** (`sites`, `assets`, `racks`, `tasks`, `contacts`, `expenses`, `floor-plans`, `monitoring`, etc. — couverts par ADR-021 §1 pattern `@CallerCtx`) | Header `X-Delegation-Id` **obligatoire** (`DelegationGuard` rejette si absent) | **non-null obligatoire** | **non-null OBLIGATOIRE** (un audit log émanant d'une action délégation-scoped sans `delegationId` = bug détectable) |

##### B.0.1 — Mapping bug détectable vs null légitime

Distinction binaire pour tests integration + observabilité audit forensique :

- **`audit_log.delegationId IS NULL` LÉGITIME** : action issue d'un endpoint listé ci-dessus en Cat 1/2/3-OptionB/4-OptionB/5/SYSTEM_CTX. Aucun bug.
- **`audit_log.delegationId IS NULL` BUG** : action issue d'un endpoint délégation-scoped (Cat ADR-021 §1) qui aurait dû propager `ctx.activeDelegationId` non-null. Détectable via :
  - Test integration : assert qu'un PATCH sur `/sites/:id` (délégation-scoped) produit un `audit_log` avec `delegationId IS NOT NULL`
  - Observabilité : alerte GlitchTip si `audit_log.delegationId IS NULL` AND `entityType IN ('site', 'asset', 'rack', 'task', 'contact', 'expense', 'floor-plan', 'monitoring-target', ...)` (entités délégation-scoped)

**Pas de CHECK constraint Postgres** retenu (entityType n'est pas un enum strict, évolution future = friction migration) — test integration + observabilité suffisent.

##### B.0.2 — Sub-décision Cat 3 + Cat 4 (self-scoped + catalog) : Option A vs Option B

Pour les catégories 3 (self-scoped : préférences notif, user-notification, user-delegations me) et 4 (catalog : asset-models), le header `X-Delegation-Id` peut être présent dans la requête (UI a une délégation active sélectionnée même si l'endpoint ne l'utilise pas pour scope les data). Deux options sémantiquement défendables :

**Option A — Capture délégation active (RECOMMANDÉE pilote air-gap)** :
- `audit_log.delegationId = ctx.activeDelegationId` (peut être null si user n'a aucune délégation active)
- **Pro** : traçabilité forensique maximale (sait quel contexte UI l'user avait au moment de l'action self-scoped) — aligne avec threat model insider air-gap pilote
- **Pro** : coût zero (passer `ctx.activeDelegationId` au audit log même si null)
- **Pro** : null reste sémantique distinct ("user n'avait pas de délégation active" vs "endpoint hors contexte délégation")
- **Con** : ambiguïté sémantique mineure — la délégation n'a aucune influence sur l'action self-scoped

**Option B — Null par convention** :
- `audit_log.delegationId = null` systématique sur Cat 3 + Cat 4
- **Pro** : sémantique pure — null = "self-scoped, pas de délégation impliquée par construction"
- **Pro** : aligne avec commentaire `caller-ctx.interface.ts:21` ("null on @SkipDelegation routes" — interprétation stricte)
- **Con** : perte info forensique sur contexte UI au moment de l'action

**Recommandation RSI Track E.4** : **Option A** car threat model air-gap insider = priorité traçabilité maximale, et le coût est nul (juste passer `ctx.activeDelegationId` qui est déjà populé). Option A documente que `null` sur Cat 3/4 signifie "user sans délégation active à ce moment", pas "endpoint sans contexte délégation".

**Arbitrage final** : ouvert au stakeholder. Track E.4 sub-pass 1.B.-1 acte la recommandation RSI mais l'implémentation Pass 1 partie B est paramétrée par cette décision (1 ligne diff dans propagation Cat 3/4).

#### B.1 — Capture systémique `ipAddress` + `userAgent` via interceptor global

Créer `AuditLogContextInterceptor` (NestJS interceptor) qui attache `req.ip` + `req.headers['user-agent']` au `CallerCtx` pour propagation jusqu'aux callers `auditLogService.log()`.

Pattern code (à implémenter v2.4.x Track E.4) :

```ts
// AuditLogContextInterceptor
@Injectable()
export class AuditLogContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    req.auditCtx = {
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    };
    return next.handle();
  }
}

// Service usage
await this.auditLogService.log({
  tenantId, userId, action, entityType, entityId, changes,
  ipAddress: req.auditCtx?.ipAddress,
  userAgent: req.auditCtx?.userAgent,
});
```

OU plus simple : extension `CallerCtx` avec `ipAddress`/`userAgent` champs et `@CallerCtx()` param decorator les remplit automatiquement.

**Décision finale du pattern (interceptor vs CallerCtx extension)** : à acter pendant l'implémentation Track E.4 — les deux respectent l'esprit de l'ADR.

#### B.2 — Ajout colonne `delegationId` au schéma `audit_log`

```prisma
model AuditLog {
  // ... champs existants
  delegationId String?  // nullable — actions tenant-wide ou pre-delegation
  delegation   Delegation? @relation(fields: [delegationId], references: [id], onDelete: SetNull)

  @@index([tenantId, delegationId, timestamp])
}
```

Migration Prisma versionnée : `add_audit_log_delegation_id`. Per **`XCH_DEMO_DATA_PRINCIPLE`** (validé 2026-04-29), aucune contrainte de migration zero-downtime ou backfill nécessaire — xch-deploy = pilote dev/démo, `prisma migrate reset --force --skip-seed` + reseed autorisé. Colonne nullable simple (pas de feature flag de transition). Pour le pilote prod air-gap employeur futur (Track E.3 cutover) : déploiement greenfield à partir de v2.4.x, pas de backfill nécessaire.

Capture côté service : récupérer `callerCtx.activeDelegationId` (déjà présent dans `CallerCtx` interface — cf. `caller-ctx.interface.ts:21`) et l'inclure dans `auditLogService.log()`.

#### B.3 — Endpoint GET /audit enrichi

Le endpoint super-admin `GET /audit` (cf. ADR-021 §6 catégorie D) doit exposer les 3 nouvelles colonnes dans la response DTO :
- `ipAddress` (optional string)
- `userAgent` (optional string)
- `delegationId` + `delegation.name` (optional via join)

## Conséquences

### Positives
- `@SkipDelegation` discipline figée → reviewer a 5 catégories explicites à valider
- AuditLog air-gap-ready : traçabilité IP/UA/délégation pour audit forensique insider threat model
- Cohérence cross-team handoff (V3+ admin) : 2 admin pouvant lire l'audit complet pour incident response

### Négatives (acceptées)
- Migration Prisma → bump v2.4.x minor (pas patch)
- Interceptor ou CallerCtx extension → quelques lignes de plomberie dans chaque controller `@CallerCtx()` decorator
- Refactor de ~50 callsites `auditLogService.log()` pour passer `ipAddress`/`userAgent` (gros mais mécanique — peut être fait par un seul PR)
- Rows historiques xch-deploy (pré-v2.4.x) → reset+seed autorisé per `XCH_DEMO_DATA_PRINCIPLE`. Pour le pilote prod employeur : greenfield Track E.3 cutover (pas de rows historiques à backfill)

### Forward dependencies
- Track E.4 implémentation B.1+B.2+B.3 (tag cible v2.4.x post-cutover)
- Track E.4 mini-PR docs : ajouter commentaires JSDoc Catégorie X sur les 23 `@SkipDelegation` existants (pure docs, 0 risque code)
- Track F potentiel : grep CI custom (`ts-morph`) qui flag `@SkipDelegation` sans commentaire `@Categorie X` (defensive enforcement)

## Alternatives considérées

1. **AuditLog enrichment via Prisma middleware** — rejeté. Middleware n'a pas accès au request context (request-scoped). Même limitation que ADR-021 §1.

2. **Capture `ipAddress`/`userAgent` dans chaque caller service** — rejeté. Trop facile à oublier, c'est la racine du bug d'enrichissement actuel (colonnes existent depuis 2026-04 mais 0 caller les populent). Interceptor global garantit la couverture.

3. **AuditLog scoped par délégation (autz row-level)** — rejeté hors scope. ADR-021 §6 catégorie D fige `auditLog` comme super-admin only en lecture, pas scoped row-level. La colonne `delegationId` est **descriptive** (audit trail), pas **enforcement** (autz). Cohérent avec ADR-021.

4. **`@SkipDelegation` remplacé par enum explicite `@TenantWide() / @PreAuth() / @SelfScoped() / @CatalogData() / @DevOnly()`** — rejeté. Trop de décorateurs nouveaux, churn API. Le commentaire JSDoc + taxonomy ADR-028 suffit.

## Plan d'exécution

- **Immédiat (Track E.1 closure)** : cet ADR-028 publié + lien depuis `docs/audit/track-e1-security-2026-05-15.md` + MCP `XCH_TRACK_E1_FINDINGS_PRIORITY_LIST_2026_05_15` mis à jour.
- **Track E.4 mini-PR docs** (~1h estimé) : ajouter commentaires JSDoc Catégorie X sur les 23 `@SkipDelegation` existants, référencer ADR-028.
- **Track E.4 PR enrichment** (~4-6h estimé) : implémenter B.1 (interceptor OR CallerCtx extension) + B.2 (migration Prisma) + B.3 (DTO update) + tests + smoke prod.
