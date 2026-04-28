# Session v1.6.1 — Quick wins post-v1.6.0

**Statut** : ✅ Livrée 2026-04-29 (tag `v1.6.1`)

Ce fichier conserve le brief original de la session pour référence
historique. Le contenu réel des changements est dans le `CHANGELOG.md`
section `[1.6.1]`.

---

Reprise après tag v1.6.0 (ADR-018 livré, 4 cibles A→D, JSON résiduel cleanup
terminé, 11 nouvelles tables, 5 migrations versionnées en place).

Cette session = première étape de la finalisation v2 telle que validée
2026-04-29 dans le plan révisé. 4 chantiers ciblés, tag v1.6.1 à la fin,
plan post-v1.6.0 persisté pour les sessions suivantes.

## PRINCIPES DIRECTEURS

1. **Règles de l'art XCH** (mémoire MCP `XCH_ENGINEERING_PRINCIPLES`,
   2026-04-20) — pas de dette technique, harmoniser, sécuriser.

2. **Données démo** (mémoire MCP `XCH_DEMO_DATA_PRINCIPLE`, 2026-04-29) —
   aucune donnée importante en prod. On peut casser pour mieux construire.
   Pas de précautions de migration, pas de coexistence, pas de scripts
   de transition. Seule contrainte : sécurisé, propre, professionnel.
   Reset+reseed sur xch-deploy autorisé.

## Chantiers

### 1. Bug Budgets double-counting

**Symptôme** : Parent 10 000 € + 2 enfants 3 000 € chacun → l'app
affichait 16 000 € total alors que la sémantique métier est 10 000 €.

**Fix** : sommer uniquement les budgets racines (`parentId === null`)
pour `totalBudgeted` et `totalSpent` dans
`frontend/src/app/dashboard/costs/budgets/page.tsx`. Seed démo
enrichi avec un 2e sous-budget (`Budget équipement IDF`).

### 2. Wizard Sites — Contact API CRUD

**Bug** : ADR-018 cible D a migré `Site.contacts` JSON-array vers la
table `Contact` (relation 1:N). Les wizards `sites/[id]/edit/page.tsx`
et `sites/new/page.tsx` ont gardé le state local `contacts` mais ne
l'envoyaient plus au PATCH/POST.

**Fix** :
- `sites/new` : POST chaque contact via `contactsApi.create` avec
  `siteId` après le success de la mutation site.
- `sites/[id]/edit` : diff create/update/delete entre l'état initial
  et l'état final, exécuté en `Promise.allSettled` après le PATCH.
- Backend `CreateContactDto` : ajout de `isPrimary` (déjà dans le
  schéma Prisma depuis ADR-018 D.1).
- Frontend `Contact` / `CreateContactDto` : ajout `isPrimary`.
- Type legacy `SiteContact` retiré, `Site.contactsOnSite` retypé en
  `Contact[]`.

### 3. Re-mesure des métriques PROJECT_STATUS

Les chiffres v1.4.x (32 modèles, 17 enums, 261 endpoints, 27 modules,
10 ADRs) sont obsolètes. Re-mesurés 2026-04-29 :
- 29 modules NestJS (+monitoring +sdwan)
- 48 modèles Prisma (+16)
- 22 enums (+5)
- 273 endpoints (+12)
- 57 composants frontend (+12)
- 18 ADRs (ADR-001 → ADR-018)

### 4. Drift doc + plan persistence + bump v1.6.1 + tag + smoke

- CHANGELOG : bloc `[Unreleased] — Audit phase 5` déplié rétroactivement
  en `[1.5.0]`. Ajout `[1.6.0]` (S2+S5+ADR-018) et `[1.6.1]` (cette
  session).
- Prompts livrés archivés en `docs/prompts/archive/`.
- README + 00-INDEX : ADR-017 + ADR-018 ajoutés au sommaire.
- Mémoire MCP `XCH_PLAN_V2_FINALIZATION` : 7 sessions vers v1.8.0
  persistées.
- PROJECT_STATUS : tableau « Plan finalization v2 vers v1.8 » ajouté.
- Bump `backend/package.json` + `frontend/package.json` 1.6.0 → 1.6.1.
- Commit unique, tag `v1.6.1` annoté, push.
- Smoke xch-deploy : reset+migrate+seed+login, créer site avec contact
  dans wizard, vérifier persistance, vérifier budget parent affiche
  bon total. NPM reload après rebuild backend.

## Hors scope

Sessions futures du plan v2 finalization :
- Session 2 : chiffrement secrets at-rest (ADR-019)
- Session 3 : NotificationConfig refacto + Worker BullMQ (ADR-020)
- Session 4 : Performance & intégrité DB
- Session 5 : Hardening tail (CSP nonce, DTOs structurés, → v1.7.0)
- Session 6 : UX dark canvas + tap targets
- Session 7 : Refonte E2E Playwright (→ v1.8.0)
- Session 8 (optionnelle) : Sentry / error tracking
