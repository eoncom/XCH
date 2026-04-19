# ADR-011 : Création d'Expense en ligne depuis Asset / Connectivity / Task

**Date :** 2026-04-20
**Statut :** Accepté
**Auteurs :** Lead technique + utilisateur (validation des 6 sous-décisions le 2026-04-20)

---

## Contexte

Aujourd'hui, créer une **dépense (Expense)** dans XCH se fait uniquement depuis le formulaire dédié `/dashboard/costs/new`. Or :

- Beaucoup de dépenses sont **conséquence directe** d'une autre opération métier :
  - L'achat d'un équipement (`Asset.acquisitionPrice`) ou sa location mensuelle (`Asset.monthlyPrice`)
  - L'ouverture d'une ligne internet (`ConnectivityLink.monthlyPrice`)
  - L'exécution d'une tâche par un prestataire (`Task.actualCost`)
- Ces données de coût sont **déjà saisies** dans les formulaires Asset / Connectivity / Task — mais l'utilisateur doit ensuite faire un **trajet manuel** vers Coûts pour ouvrir une dépense correspondante. Friction + risque d'oubli.

État existant audité phase 6 :
- ✅ **Connectivity → Expense** : déjà implémenté (`POST /connectivity/:id/generate-expense`, dialog UI)
- ❌ **Asset → Expense** : promis dans le CHANGELOG v1.3 (« Création automatique d'Expense liée quand un asset a un prix ») mais **jamais codé** dans `assets.service.ts`
- ❌ **Task → Expense** : champs `estimatedCost` / `actualCost` saisis mais aucune conversion vers Expense

L'utilisateur a explicitement demandé (2026-04-20) la possibilité de créer une dépense **lors de l'ajout ou édition** d'un équipement, d'un lien internet, ou d'une tâche prestataire.

---

## Décision

Implémenter une **création d'Expense « en ligne »** depuis les trois sources, avec ce contrat :

### 1. Stratégie de création — **manuel pré-coché**

Une **case à cocher** « Créer la dépense liée » apparaît dans les formulaires `Asset`, `ConnectivityLink`, `Task`. Elle est :

- **Pré-cochée** quand un prix non-nul est détecté (`AssetModel.acquisitionPrice/monthlyPrice` sélectionné, `ConnectivityLink.monthlyPrice` saisi, `Task.actualCost` rempli en finalisant la tâche)
- **Décochable** explicitement par l'utilisateur (cas où il préfère gérer la dépense ailleurs ou ne pas en créer)
- **Désactivée** si l'utilisateur n'a pas le droit `WRITE` sur la délégation cible (cf. décision 4)

Quand cochée, un mini-form s'affiche avec :
- **Centre de coût (BillingEntity)** — Select obligatoire (« qui paie ? »)
- **Label** — pré-rempli selon la source (modifiable)
- **Type Expense** — pré-rempli (cf. décision 5), modifiable
- **Frequency** — pré-rempli (cf. décision 5), non modifiable

### 2. Synchronisation post-création — **figé + bouton Resync**

L'Expense créée est **figée à sa valeur initiale**. Les modifications ultérieures du prix de l'Asset / Connectivity / Task **ne se propagent PAS** automatiquement à l'Expense.

À la place, un **bouton « Resync dépense »** apparaît sur la fiche de l'entité source quand :
- une `expenseId` est liée
- ET le prix actuel de l'entité diffère du `totalAmount` de l'Expense liée

Cliquer ouvre un dialog de confirmation montrant la différence (`avant: X € → après: Y €`) et propose un PATCH sur l'Expense liée.

**Pourquoi figé** : éviter les surprises comptables (« le prix d'achat s'est mis à jour tout seul »). L'opérateur garde le contrôle explicite.

### 3. Champs de liaison schema

Ajouter `Task.expenseId String?` (nullable, 1:1) dans `schema.prisma`, symétrique avec `ConnectivityLink.expenseId`.

`Expense.assetId` existe **déjà** dans le schema ([schema.prisma:1117](../../backend/prisma/schema.prisma:1117)). Pas de FK à ajouter pour Asset.

| Source | Champ FK | Direction |
|---|---|---|
| Asset | `Expense.assetId` (déjà présent, scalaire) | Expense → Asset |
| ConnectivityLink | `ConnectivityLink.expenseId` (déjà présent) | Link → Expense |
| Task | `Task.expenseId` (à ajouter) | Task → Expense |

Inversion volontaire pour Asset : un Asset peut générer plusieurs dépenses au fil du temps (ONE_TIME à l'achat puis MONTHLY pour location), alors qu'un Link et une Task ont une seule dépense canonique.

### 4. Permissions — RBAC strict

L'utilisateur qui déclenche la création doit avoir `WRITE` sur la délégation **cible de l'Expense** (cf. décision 6 pour le calcul de la délégation cible).

- Si pas le droit : la case à cocher est désactivée + tooltip « Vous n'avez pas le droit de créer des dépenses sur cette délégation ».
- Le backend rejette toute requête sans le bon scope (le DTO actuel `CreateExpenseDto` impose déjà `delegationId` non vide + le `PermissionGuard` vérifie WRITE).

Le bouton « Resync » exige aussi `WRITE`.

### 5. Defaults type + frequency

| Source | `Expense.type` | `Expense.frequency` |
|---|---|---|
| Asset (`acquisitionPrice` saisi) | `EQUIPMENT` | `ONE_TIME` |
| Asset (`monthlyPrice` saisi) | `LICENSE` | `MONTHLY` |
| ConnectivityLink | `SERVICE` (déjà) | `MONTHLY` (déjà) |
| Task (`actualCost` à la complétion) | `SERVICE` | `ONE_TIME` |

**`LICENSE` pour `Asset.monthlyPrice`** est validé par l'utilisateur — couvre les abonnements logiciels ET les locations mensuelles d'équipement.

### 6. Délégation cible

L'`Expense.delegationId` est calculée dans cet ordre :

1. Si l'entité source a un `siteId` : `expense.delegationId = site.delegation.id`
2. Sinon (asset en stock, task non rattachée) : `expense.delegationId = req.delegationId` (header `X-Delegation-Id` du caller, vérifié par `DelegationGuard`)
3. Si aucune des deux : retourne `400 Bad Request` avec message clair

Cette règle est cohérente avec la règle R1 du modèle delegation-first (un Expense est obligatoirement rattaché à une délégation).

---

## Conséquences

### Positives

- **Friction réduite** : l'utilisateur peut suivre les coûts au fil de la saisie opérationnelle, pas en deuxième temps
- **Cohérence financière** : moins de dépenses « oubliées » → reporting plus complet
- **Découvrabilité** : la case à cocher rend la feature visible (vs un endpoint caché qu'on appelle depuis un menu obscur)
- **Respect du RBAC** : aucun contournement, les checks WRITE existants s'appliquent
- **Compat backward** : l'utilisateur peut décocher → comportement actuel inchangé

### Négatives

- **Couplage modules** : `assets.service` et `tasks.service` doivent désormais connaître `ExpensesService`. Atténué en gardant la logique métier dans une méthode publique de `ExpensesService.createFromSource(asset|task|link)` injectée.
- **Duplication possible** : si l'utilisateur coche la case à la création **et** appelle ensuite manuellement `POST /expenses` avec le même `assetId`, on aura 2 expenses. **Mitigation** : le mini-form propose le toggle uniquement à la création OU lors d'une modification de prix (pas à chaque edit). Pour les Connectivity et Task, la contrainte 1:1 (FK) empêche la duplication. Pour Asset, on accepte la possibilité de plusieurs Expenses (cf. décision 3 inversion).
- **Dette de migration** : un schema change requiert `prisma db push --accept-data-loss` (sans perte réelle, ajout de colonne nullable).

### Alternatives écartées

1. **Auto-création silencieuse à chaque saisie de prix** — rejetée pour le risque de surprises comptables, et car certains utilisateurs ne veulent pas générer d'Expense (équipement offert, dépense déjà tracée ailleurs).

2. **Auto-sync bidirectionnel asset.price ↔ expense.totalAmount** — rejetée pour les mêmes raisons que 1. Trop magique pour un module financier.

3. **Une seule Expense globale par Asset, mise à jour automatiquement** — rejetée car ne reflète pas la réalité métier : un même Asset peut accumuler plusieurs Expenses dans le temps (achat + maintenance + remplacement composant).

4. **Convertir entièrement le formulaire Asset/Task en wizard multi-étapes** — rejeté pour la complexité UX (les utilisateurs créent souvent des Assets sans aspect financier, ne pas les forcer à passer par un step Coûts).

---

## Plan d'implémentation

### Lot 1 — Schema + migration (15 min)

- Ajouter `Task.expenseId String?` dans `schema.prisma` + relation `Expense?` côté Task
- `prisma db push --accept-data-loss` au prochain démarrage backend (entrypoint déjà configuré)
- Index `@@index([expenseId])` sur Task

### Lot 2 — Backend `ExpensesService.createFromAsset()` + endpoint (45 min)

- Méthode publique `ExpensesService.createFromAsset(tenantId, assetId, dto: CreateFromAssetDto)` :
  - Valide l'existence de l'Asset
  - Calcule la délégation cible (cf. décision 6)
  - Vérifie permissions WRITE (via `PermissionService.resolve`)
  - Construit l'Expense (label, type, frequency, totalAmount = `acquisitionPrice` ou `monthlyPrice` selon le `kind` du DTO)
  - `prisma.expense.create` avec `assetId` lié
  - Retourne l'Expense créée
- Nouvel endpoint `POST /assets/:id/generate-expense` (`@RequireWrite`) avec body `{ kind: 'ACQUISITION' | 'MONTHLY', bearerId, label?, type? }`

### Lot 3 — Backend `ExpensesService.createFromTask()` + endpoint (30 min)

- Symétrique au Lot 2, FK `Task.expenseId` (1:1, refuse si déjà lié)
- Nouvel endpoint `POST /tasks/:id/generate-expense` (`@RequireWrite`) avec body `{ bearerId, label?, useEstimated?: boolean }`. Si `useEstimated=true` ou `actualCost=null`, prend `estimatedCost`.

### Lot 4 — Backend Resync (30 min)

- Méthode `ExpensesService.resyncFromSource(expenseId, sourceKind)` qui recalcule le `totalAmount` depuis l'entité source + audit log la modification
- 3 endpoints :
  - `PATCH /assets/:id/expenses/:expenseId/resync` (recalcule depuis Asset)
  - `PATCH /tasks/:id/resync-expense` (recalcule depuis Task)
  - `PATCH /connectivity/:id/resync-expense` (recalcule depuis ConnectivityLink, déjà partiellement présent dans `connectivity.service.ts:92`)

### Lot 5 — Frontend Asset form (1h)

- Composant `<GenerateExpenseToggle>` réutilisable dans `assets/new` + `assets/[id]/edit`
- État local : `generateExpense: boolean` (pré-coché si `acquisitionPrice` ou `monthlyPrice` non nul ET WRITE sur délégation)
- Mini-form révélé : Select Centre de coût (depuis `billingEntitiesApi.getAll`), Label (auto-rempli), badge type fixé
- Au submit du formulaire Asset, si toggle coché → appel `POST /assets/:id/generate-expense` après le `POST /assets`

### Lot 6 — Frontend Task form (1h)

- Idem sur `tasks/new` + `tasks/[id]/edit`
- Toggle révélé seulement si `status === 'DONE'` ET (`actualCost` ou `estimatedCost` saisi)

### Lot 7 — Frontend Resync UI (45 min)

- Bouton « Synchroniser dépense » sur les fiches asset/task/connectivity quand une Expense est liée
- Détection drift : compare `expense.totalAmount` au prix actuel de la source (calcul côté front pour éviter un endpoint dédié)
- Dialog confirmation avec diff visible

### Lot 8 — Frontend Connectivity (cohérence UI) (15 min)

- Ajouter le même toggle à la création de ConnectivityLink (au lieu d'avoir l'endpoint séparé après coup)
- Garder l'endpoint `generate-expense` existant pour les liens créés sans Expense (cas legacy)

### Lot 9 — Tests fumée + déploiement (30 min)

- Curl scripted : créer asset avec prix → vérifier Expense liée + asset.expenseId présent
- UI manuelle : toggle visible/caché selon permissions, edit asset, resync visible quand prix change
- Migration `prisma db push` automatique au démarrage backend

**Charge totale estimée : ~5h30** (sans tests E2E Playwright qui restent post-MVP).

---

## Risques

1. **Migration en prod** : ajouter `Task.expenseId` est non-destructif (colonne nullable). Pas de rollback nécessaire. Si on rollback ce ADR, la colonne reste vide → no-op.
2. **Volumétrie audit log** : chaque resync produit une entrée `AuditLog`. Acceptable au volume actuel (< 1000 dépenses).
3. **Race condition** : si deux super-admins génèrent une Expense pour le même asset en parallèle, on a 2 Expenses. Pour Connectivity/Task la FK `expenseId` empêche le doublon (contrainte unique de fait via le 1:1). Pour Asset, c'est accepté par design.

---

## Références

- AUTH_MODEL.md §1 (rights MANAGE/WRITE/READ)
- ADR-009 (delegation-first, R1 contrainte délégation/site)
- CHANGELOG v1.3 Lot C (où la promesse non tenue avait été annoncée)
- Reports phase 5 et phase 6 (qui ont confirmé l'absence d'implémentation côté Asset/Task)

---

**À implémenter** : 9 lots ci-dessus, dans l'ordre listé. Backend d'abord (lots 1-4), puis frontend (lots 5-8), puis validation (lot 9). Un seul rebuild backend+frontend final.
