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

Signature canonique :
```ts
export function toMonitorSummaryResponseDto(
  rows: Array<{ window: string; total: bigint; up: bigint }>,
): MonitorSummaryResponseDto { ... }
```

Le helper vit dans `modules/<m>/dto/<x>.response.dto.ts` à côté de la classe
DTO, fonction nommée `to<DtoName>` (sans le suffixe `Dto` à la fin pour
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

## Anti-patterns

- ❌ `toMatchSnapshot()` dans dto-shape.spec — préférer `toHaveProperty`
  + `not.toHaveProperty` pour verrouiller l'anti-leak champ par champ.
- ❌ `as any` dans le retour controller — interdit (lint enforced).
- ❌ Plusieurs classes DTO dans un même fichier — 1 entité = 1 fichier.
- ❌ `@Expose()` oublié sur un champ → exclu silencieusement par
  `excludeExtraneousValues: true`. Test dto-shape attrape la régression.
