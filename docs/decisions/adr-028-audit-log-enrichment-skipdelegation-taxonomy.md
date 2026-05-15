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
