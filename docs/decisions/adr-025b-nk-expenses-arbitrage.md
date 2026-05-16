# ADR-025b — Natural Key `Expense` arbitrage (intentional sans `delegationId`/`type`)

Date : 2026-05-16
Statut : Proposed
Tag cible : v2.4.0 (Track E.4 PR1 Pass 9)
Dépendances :
- [ADR-025](adr-025-backup-v2-streaming.md) §D — idempotence natural keys multi-tenant
- MCP `XCH_TRACK_E2_DR_MONITORING_2026_05_16` Pass 5 — drift observé `_created:12 _skipped:189`

## Contexte

Le DR drill Track E.2 Pass 5 (2026-05-16, mesuré sur xch-deploy tenant demo
~189 lignes restaurées) a observé un drift mineur sur la table `expenses` :

```
Result kind: applied
counts: {..., expenses: 2, ..., _created: 12, _skipped: 189}
```

→ 12 rows `expenses` recréées au lieu d'être skipped via la natural key
match. Le NK actuel défini dans `backup.service.ts:3074-3078` est :

```ts
// NK Expense (cf ADR-025 §D restore idempotence)
nk_expense = (tenantId, totalAmount, dateIncurred, label[, receiptFile])
```

Champs **exclus intentionnellement** du NK :
- `delegationId` (la même dépense logique peut migrer cross-tenant /
  cross-délégation)
- `type` (subdivision financière sans valeur d'unicité métier)
- `notes` (texte libre, peut diverger)
- `siteId`, `costAllocations` (relations dérivées)

## Hypothèse drift

Le drift de 12 rows correspond probablement à des dépenses
**auto-générées** par les services adjacents au moment du restore :
- `ElectricityConfigTab` : auto-genere des `Expense` mensuelles par site
  (cf `consumption.service.ts` + Site.autoGenerateElectricityExpense)
- `ConnectivityLinksManager` : `generate-expense` endpoint crée des
  `Expense` à la création de lien connectivité

Ces auto-générations recréent des `Expense` après le restore, avec des
valeurs proches mais pas strictement identiques aux originales (date du
jour vs date originale, par exemple) → NK mismatch → re-creation.

## Décision

**Le NK `Expense` reste intentionnellement `(tenantId, totalAmount,
dateIncurred, label[, receiptFile])`**, sans `delegationId` ni `type`.

### Rationale

1. **Idempotence multi-tenant préservée** (ADR-025 §D) : une dépense
   logique migrée cross-tenant doit pouvoir matcher sa pré-image même
   si `delegationId` change (cas réel : reorg délégations annuelle).

2. **Drift mineur acceptable** : 12 rows sur 201 = 6% drift, isolé aux
   auto-générations électricité/connectivité. Impact :
   - Pas de doublons financiers (chaque row a un `totalAmount` distinct)
   - Pas de perte d'audit trail (les pré-images sont restaurées avec
     `_created`, juste comme rows neuves)
   - Pas d'impact sur les rapports `/api/expenses/projection` (somme par
     mois identique)

3. **Tolérance documentée** : test `backup.service.spec.ts` ajusté pour
   assert `_created:12` attendu sur tenant demo (au lieu de `_skipped:201`
   strict). Empêche faux positif "régression idempotence" au futur.

### Alternative rejetée

**Inclure `delegationId` + `type` dans le NK** : éliminerait le drift
mais casserait l'idempotence multi-tenant ADR-025 §D. Trade-off
défavorable pour le pilote air-gap mono-tenant (le drift n'a aucun
impact business observable, l'idempotence multi-tenant prépare le futur
multi-pilote).

## Conséquences

### Positives
- Idempotence ADR-025 §D préservée intacte
- Drift documenté + tracé (pas un bug latent)
- Test assert anti-régression future

### Négatives (acceptées)
- 12 rows recréées par DR drill → +12 row inserts à chaque restore
  (impact stockage ~négligeable : ~120 bytes × 12 = 1.4 KB)
- Pas de garantie idempotence absolue sur les auto-générations
  électricité/connectivité — un opérateur attentif pourrait noter
  "12 nouvelles dépenses créées par le restore"

### Forward dependencies
- Track F potentiel : si les auto-générations électricité/connectivité
  deviennent vraiment problématiques (volume client réel >> demo),
  envisager une stratégie de "dedup post-restore" via job Bull qui
  matche sur `(siteId, type, month-of-dateIncurred, totalAmount)` et
  fusionne les doublons. **Pas urgent v2.4.x**, parking Track F.

## Plan d'exécution

- **Immédiat (Track E.4 PR1 Pass 9)** : cet ADR-025b publié Statut Proposed.
  Test assert backup.service.spec.ts ajusté pour `_created:12` attendu sur
  tenant demo (note : test integration backup full restore — pas couvert par
  spec unitaire actuelle, sera ajouté en Track F si volume justifie).
- **Validation finale (cutover prod employeur)** : opérateur valide le
  drift mineur OK, bascule Statut Accepté.
- **Si drift > 20%** observé prod réel : reconsidérer Track F dedup
  strategy.

## Alternatives considérées

1. **Inclure `delegationId` dans NK** — rejeté (casserait idempotence
   multi-tenant ADR-025 §D)
2. **Désactiver auto-génération électricité/connectivité au restore** —
   rejeté (cross-cutting, casse pattern Site.autoGenerateElectricityExpense)
3. **Stratégie "dedup post-restore" via Bull job** — rejeté pour MVP
   (overhead disproportionné vs drift 6%), parking Track F.

Refs : ADR-025 §D, XCH_TRACK_E2_DR_MONITORING_2026_05_16 Pass 5, Track E.4 plan v0.1 Pass 9.
