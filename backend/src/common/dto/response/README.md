# Response DTO discipline (XCH backend)

Source de vérité de la règle hybride `plainToInstance` vs helper manuel pour
mapper une entité Prisma vers un Response DTO contractuel. Cf [ADR-023](../../../../../docs/decisions/adr-023-dto-discipline.md).

## Règle de frontière (3 cas)

### Cas A — `plainToInstance` direct (entité Prisma plate)

**Critère** : la réponse est UNE entité Prisma scalaire, sans relations (`include`).

Implémentation :
```ts
return toResponse(SiteResponseDto, prismaSite);
```

Le DTO déclare `@Expose()` sur chaque colonne légitime. Tout champ Prisma
sensible (`passwordHash`, internal flags, secrets) est implicitement exclu
via `excludeExtraneousValues: true`.

### Cas B — Helper manuel `to<X>ResponseDto()` (shape calculée / agrégée / minimaliste)

**Critère** : (1) shape composite calculée à partir de plusieurs queries,
OU (2) DTO avec champs computed (uptime % calculé), OU (3) shape minimaliste
ack/delete/enqueue (`{ deleted: true }`, `{ count: N }`).

**Signature canonique (figée pour la cascade S9)** :
```ts
export function to<X>ResponseDto(
  input: <ServiceReturnShape>,
  ctx?: ResponseMappingCtx,
): <X>ResponseDto { ... }
```

- `input` : la valeur brute renvoyée par le service (rows `$queryRaw`,
  composite cross-query, agrégat scalaire).
- `ctx?: ResponseMappingCtx` : **toujours en 2ᵉ position, optionnel**. À
  ajouter dès qu'un helper a besoin du `CallerCtx` / `tenantId` /
  permissions pour mask des champs ou enrichir une projection
  (ex: RBAC partial reveal, tenant-specific feature flags). Ne pas
  rajouter de 3ᵉ paramètre — étendre `ResponseMappingCtx` plutôt.
- Le type `ResponseMappingCtx` est exporté depuis
  `backend/src/common/utils/to-response.util.ts` ; aujourd'hui il est
  vide (placeholder), on l'enrichit incrémentalement par PR cascade.

Exemple actuel sans `ctx` :
```ts
export function toMonitorSummaryResponseDto(
  rows: Array<{ window: string; total: bigint; up: bigint }>,
): MonitorSummaryResponseDto { ... }
```

Exemple futur avec `ctx` (illustratif, à venir si un module en a besoin) :
```ts
export function toUserResponseDto(
  prismaUser: User,
  ctx?: ResponseMappingCtx,
): UserResponseDto {
  // ctx?.callerCtx peut décider d'omettre `email` pour un caller non-admin
}
```

Le helper vit dans `modules/<m>/dto/<x>.response.dto.ts` à côté de la classe
DTO, fonction nommée `to<DtoName>` (sans suffixe `Dto` final pour
éviter `toMonitorSummaryResponseDtoDto`).

### Cas C — `plainToInstance` + `@Type()` (entité Prisma avec relations)

**Critère** : entité Prisma avec relations incluses via `include`. Chaque
relation imbriquée déclare son propre Response DTO (référence courte type
`<X>RefResponseDto` quand on n'expose qu'un sous-ensemble id/name).

Implémentation :
```ts
@Expose()
@Type(() => HttpConfigResponseDto)
httpConfig?: HttpConfigResponseDto;

@Expose()
@Type(() => SiteRefResponseDto)
site?: SiteRefResponseDto;
```

Puis `return toResponse(MonitorCheckResponseDto, prismaCheck)` côté service.

## Arbre de décision (3 questions)

1. **La réponse est-elle un objet UTILE custom et non-Prisma ?**
   (ex: `{ deleted: true }`, agrégation 3 fenêtres, statut composite)
   → **Cas B** — helper manuel.

2. **L'entité Prisma a-t-elle des relations imbriquées dans la réponse ?**
   (`include: { site: true, asset: true, ... }`)
   → **Cas C** — `plainToInstance` + `@Type()` sur les relations.

3. **Sinon** : réponse = entité Prisma scalaire pure
   → **Cas A** — `plainToInstance` direct.

## Convention nommage

- Fichier : `<entity>.response.dto.ts` (ex: `monitor-check.response.dto.ts`)
- Classe : `<Entity>ResponseDto` (ex: `MonitorCheckResponseDto`)
- Reference compact : `<Entity>RefResponseDto` (ex: `SiteRefResponseDto` =
  `{ id, name, code }` extrait pour relation imbriquée)
- Helper Cas B : `to<Entity>ResponseDto(input): <Entity>ResponseDto`
- Test : `backend/test/modules/<m>/dto-shape.spec.ts`

## Pièges connus

### `Record<string, T>` ne roundtrip pas sous `excludeExtraneousValues`

`plainToInstance(...)` avec `excludeExtraneousValues: true` traite les
sous-objets comme des classes à instancier. Sans `@Type(() => Concrete)`,
les valeurs dynamic-key disparaissent (résultat = `{}`).

**Deux options selon le shape** :

1. **Helper Cas B** (recommandé pour les shapes calculés / composites) —
   construit le DTO manuellement avec spread copy.
   Reference : `toRestoreFullResultResponseDto` dans
   `modules/backup/dto/restore-result.response.dto.ts`.

2. **`@Transform(({obj}) => obj.field)`** (recommandé pour les JSON
   Prisma fields embedded dans une entité) — `obj` accède au plain source
   object, contournant le pipeline d'instantiation de classe.
   Reference : `RackResponseDto.specs` dans
   `modules/racks/dto/rack.response.dto.ts`.

`@Transform(({value}) => ({...value}))` ne marche PAS — `value` est déjà
filtrée par `excludeExtraneousValues` quand le transform s'exécute.
`obj` lit la source plain telle quelle, donc fonctionne.

### `Prisma.Decimal` corrompu sur champ typé `string | number` (union)

Découvert pendant la cascade S9 PR #16 (budgets). Toujours typer un
champ `Decimal` Prisma comme **`number`** (pas `string | number`).

**Cause** : `toResponse()` active `enableImplicitConversion: true`, qui
lit la métadonnée TypeScript `design:type` exposée par `reflect-metadata`.
- `amount!: number` → métadonnée = `Number` → la conversion route par
  `Number(value)`, qui appelle `Decimal.valueOf()` (= primitif numérique).
  Le wire payload est un nombre JSON propre `40000`.
- `amount!: string | number` → métadonnée = `Object` (les unions sont
  effacées) → class-transformer shallow-copie les internes Decimal
  (`{s, e, d}`) sans appeler `toJSON`, et le wire payload sort en
  `{}` (vide) ou (selon timing du `@Transform`) `"[object Object]"`.

**Pattern figé pour post-v2.0** :

```ts
// ✅ correct — wire = number
@ApiProperty({ description: 'Decimal(12,2) — coerced via Decimal.valueOf()' })
@Expose()
amount!: number;

// ❌ corrompu — wire = {} ou "[object Object]"
@Expose()
amount!: string | number;
```

Référence consommateurs OK : `expense.response.dto.ts` (`amount!: number`,
`totalAmount!: number`), `budget.response.dto.ts` (`amount!: number`,
`BudgetParentRefResponseDto.amount!: number`). Test runtime smoke en
place dans `__tests__/reliquats-dto-shape.spec.ts` (`Prisma.Decimal`
sample → wire `number === 40000`, jamais d'objet `{s,e,d}`).

Si la précision décimale au-delà du JS safe number est critique pour
un champ donné (montants > 9 × 10¹⁵), exposer le Decimal en `string`
explicite via Cas B helper qui fait `value.toString()` AVANT que
class-transformer ne touche la valeur — pas via `string | number`.

## Anti-patterns

- ❌ `toMatchSnapshot()` dans dto-shape.spec — préférer `toHaveProperty`
  + `not.toHaveProperty` pour verrouiller l'anti-leak champ par champ.
- ❌ `as any` dans le retour controller — interdit (lint enforced).
- ❌ Plusieurs classes DTO dans un même fichier — 1 entité = 1 fichier.
- ❌ `@Expose()` oublié sur un champ → exclu silencieusement par
  `excludeExtraneousValues: true`. Test dto-shape attrape la régression.
- ❌ `Record<string, T>` mappé via `plainToInstance` (cf piège ci-dessus).
- ❌ `Decimal` Prisma exposé en `string | number` (union) — la
  métadonnée perdue corrompt la sérialisation. Toujours `number` pur
  (cf piège « Prisma.Decimal corrompu » ci-dessus).
