# ADR-023 : Response DTO discipline (anti-leak Prisma + Swagger contrat)

Date : 2026-05-05
Statut : Accepté
Tag cible : v1.11.0 (intermédiaire S9, post vague A+B) ou v2.0.0 (direct, selon critère §6).
Dépendances :
- Plan v2 finalization (mini-session S9 — Hardening tail)
- ADR-021 (RBAC universal data filtering — surface API durcie)
- v1.10.0 (baseline backend Jest 193/193, frontend typecheck 0/0)

## Contexte

Audit pré-S9 (2026-05-05) :

- **261 endpoints HTTP** sur 30 modules backend, **0 ResponseDto formel**,
  100% des modules en risque leak Prisma direct dans la réponse client.
- **141 `as any` + 31 `Record<string, any>`** dans 24+17 fichiers — surface
  API non-typée structurellement.
- **0% type return explicite** sur les controllers (`Promise<MonitorCheck>`
  inféré depuis Prisma, pas un DTO contrat).
- **0% `@ApiResponse({ type: ... })`** Swagger renseigné — Swagger UI
  affiche `unknown` pour la grande majorité des endpoints.

Trois problèmes concrets que cela crée :

1. **Leak silencieux** — toute nouvelle colonne Prisma sensible (token, hash,
   internal flag, audit timestamp) ajoutée à un modèle se retrouve par défaut
   dans la réponse client. Pas de garde-fou structurel ; on dépend du
   reviewer pour le repérer dans le diff.
2. **Pas de contrat versionnable** — le shape API est dérivé du shape Prisma,
   donc tout `prisma migrate` est potentiellement un breaking change client
   non documenté. Le frontend XCH consomme via TanStack Query avec types
   inférés sans validation runtime.
3. **Swagger inutilisable** — pour un futur pilote externe ou un
   intégrateur tiers, l'API doc n'expose que les Request DTOs ; le shape de
   réponse est invisible. Bloquant pour les pilotes contractualisés
   (entité MCP `XCH_PLAN_V2_FINALIZATION` obs[57]).

## Décision

S9 — Hardening tail établit la discipline suivante, livrée en cascade par
domaine module (1 PR / module, ordre par effort croissant) :

### 1. Tout endpoint expose un `*ResponseDto`

- Classe TypeScript décorée `@Expose()` champ par champ (whitelist explicite).
- Co-localisée dans `backend/src/modules/<m>/dto/<x>.response.dto.ts`
  (cohérent avec les Request DTOs existants).
- 1 fichier = 1 entité. Exception unique : utilities partagées
  (`DeletedResponseDto`, `EnqueuedResponseDto`, `AcknowledgedResponseDto`,
  `CountResponseDto`) regroupées dans `common/dto/response/action.response.dto.ts`.

### 2. Primitives partagées dans `backend/src/common/dto/response/`

- `BaseResponseDto` (id + createdAt + updatedAt, pour héritage éventuel).
- `PaginatedResponseDto<T>` — envelope keyset cursor (`items`, `limit`,
  `nextCursor`, `hasNext`). Pattern issu de S5 PR4 R1 sur `monitor-results`.
- `ErrorResponseDto` aligné avec `AllExceptionsFilter` existant
  (`statusCode`, `error`, `message`, `timestamp`, `path`).

### 3. Mapping hybride documenté dans le README

`backend/src/common/dto/response/README.md` est la source de vérité opérationnelle
de la règle de frontière. Trois cas :

- **Cas A — `plainToInstance` pur** : entité Prisma plate (sans `include`).
  ~70% des endpoints estimés. `return toResponse(SiteResponseDto, prismaSite)`.
- **Cas B — Helper manuel `to<X>ResponseDto()`** : shape composite,
  agrégation cross-table, calcul custom (uptime %, severity rollup), shape
  minimaliste (ack / delete / enqueue). ~30% des endpoints.
- **Cas C — `plainToInstance` + `@Type()` sur relations imbriquées** :
  Prisma + `include` (ex: monitor-check + httpConfig + site + asset + link).

Wrapper canonique `backend/src/common/utils/to-response.util.ts` :

```ts
export function toResponse<T>(cls: ClassConstructor<T>, plain: unknown): T {
  return plainToInstance(cls, plain, {
    excludeExtraneousValues: true,
    enableImplicitConversion: true,
  });
}
```

`excludeExtraneousValues: true` est la garantie anti-leak structurelle.

### 4. Type return explicite sur tous les endpoints

```ts
async findOne(...): Promise<MonitorCheckResponseDto> { ... }
```

Et `@ApiResponse({ type })` / `@ApiOkResponse({ type })` /
`@ApiCreatedResponse({ type })` Swagger obligatoire — enforced par CI
(§5).

### 5. Garde-fou CI bloquant : `dto-coverage.yml`

Workflow GitHub Actions exécute `backend/scripts/check-dto-coverage.ts`
qui parcourt tous les `*.controller.ts` et fail si un endpoint HTTP
n'a pas son `@ApiResponse({ type })` adjacent (10 lignes).

Baseline `backend/scripts/dto-coverage-baseline.json` exempte les
modules pas encore migrés (allowlist par fichier). Le PR cascade
correspondant retire son entrée dans la même PR que la migration
ResponseDto. Quand baseline `[]`, la garde devient strictement bloquante.

### 6. ClassSerializerInterceptor global

Activé dans `backend/src/main.ts` (`useGlobalInterceptors`). Combine avec
`@Expose()` pour assurer la sérialisation finale même quand le controller
omet `toResponse(...)` (pratique pour les types primitifs / shapes
construits inline).

### 7. Tests dto-shape.spec.ts par module

Tests d'inclusion explicites :
- `expect(dto).toHaveProperty('field')` sur chaque champ exposé légitime.
- `expect(dto).not.toHaveProperty('passwordHash' | 'secret*' | 'internal*')`
  pour verrouiller l'anti-leak.
- **Pas de `toMatchSnapshot`** — un snapshot diff est opaque en review,
  alors qu'une assertion explicite force la révision sur la ligne nominale.

## Pattern de référence

Module pivot de cette PR : `backend/src/modules/monitoring/`. 11 endpoints
qui couvrent les 3 archétypes :

- **Cas C** entité avec relations : `MonitorCheckResponseDto` +
  `MonitorHttpConfigResponseDto` + `MonitorSiteRefResponseDto` +
  `MonitorAssetRefResponseDto` + `MonitorLinkRefResponseDto` (via `@Type()`).
- **Cas C paginé** : `MonitorHistoryResponseDto extends PaginatedResponseDto<MonitorHistoryItemResponseDto>` (subclass concret pour Swagger).
- **Cas B helper** : `toMonitorSummaryResponseDto(rows)` mappe les `bigint`
  de `$queryRaw` UNION ALL en `Record<'24h'|'7d'|'30d', { total, up, uptime }>`.
- **Cas B inline** : `DeletedResponseDto` (`{ deleted: true }`),
  `EnqueuedResponseDto`, `AcknowledgedResponseDto`, `CountResponseDto`.

Chaque module en cascade reproduit le pattern à l'identique.

## Conséquences

**Positives**
- Anti-leak structurel (whitelist `@Expose()` + `excludeExtraneousValues`).
- Swagger UI exploitable pour pilotes externes / intégrateurs tiers.
- Type return explicite sur 261 endpoints à terme = surface contractuelle
  versionnable.
- Garde-fou CI bloquant prévient toute régression silencieuse post-cascade.
- ~15 modules de la cascade éliminent au passage les `as any` /
  `Record<string, any>` accumulés.

**Négatives**
- ~80 fichiers DTO créés, ~30 nouveaux tests dto-shape.spec.
- Coût de maintenance : chaque nouveau champ Prisma exposé doit être
  `@Expose()`-d explicitement dans le DTO concerné (ce qui EST le but, mais
  ralentit légèrement le développement de fonctionnalités tierces).
- Cascade de 16 PRs par domaine — étalée sur ~2-3 semaines selon rythme.

## Découpe S9 (rappel — détail dans le plan v2)

| #  | Scope | Vague | Effort |
|----|-------|-------|--------|
| 1  | Baseline pivot — monitoring + ADR-023 + README + script CI | — | M |
| 2-5 | connectivity, notifications, backup, racks | A | S |
| 6-11 | sites, tenants, users, floor-plans, integrations, tasks | B | M |
| 12-15 | assets, asset-models, expenses+billing, auth | C | L/XL |
| 16 | reliquats groupés (15 modules ≤ 6 endpoints) | D | M |
| 17 | CSP nonce dynamique (frontend) | D | S |

Tag intermédiaire v1.11.0 si vague A merge en ≤ 4 jours ouvrés ;
sinon direct v2.0.0. Critère mesuré, pas d'arbitrage à l'instinct.

## Alternatives considérées

1. **Mapping manuel `to<X>ResponseDto` partout** — verbeux (~80 helpers
   identiques) et oublis garantis sur 261 endpoints. Rejeté au profit de
   l'hybride (`plainToInstance` pour le standard, helper pour le custom).
2. **Centralisation `backend/src/dto/responses/`** — casse la cohésion
   domain-driven du codebase (Request DTOs déjà co-localisés). Rejeté.
3. **Schema Zod / Valibot runtime validation côté response** — coût
   supplémentaire (deps + double maintenance schema vs class). Rejeté pour
   S9 ; pourrait être ré-évalué post-v2.0.0 si Sentry remonte des shapes
   non-conformes en prod.
4. **Découpe par couche (tous DTOs en bulk, puis tous controllers, puis
   tous services)** — reviews monolithiques imbloquables sur 261 endpoints.
   Rejeté ; arbitrage user 2026-05-05 = découpe par module.
