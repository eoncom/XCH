# Phase 6.6 — Cleanup UX + Cohérence formulaires + Refacto SD-WAN

**Date :** 2026-04-20
**Auteur :** Claude Opus 4.7 (1M context) — worktree `peaceful-mahavira-9f0909`
**Contexte :** Suivi du principe directeur XCH énoncé le 2026-04-20 — « Toujours faire propre, pas de dette technique. Règles de l'art, cohérence, zéro dette sans négliger la sécurité. »

---

## Résumé exécutif

- **7 lots livrés.** ~30 fichiers touchés, 3 nouveaux modèles Prisma, 1 nouveau module NestJS (sdwan), 1 composant UI virtualisé générique (EntitySelectCombobox), 1 helper currency centralisé.
- **Dette JSON tracée.** ADR-013 pour les 2 poches JSON résiduelles (`NotificationConfig`, `Asset.networkInfo` split monitoring vs non-monitoring) — sessions dédiées planifiées.
- **Zéro régression attendue** sur les flux critiques (auth, permissions, RBAC). Les refactos touchent : (a) des chemins déjà morts (`ConnectivityV2.sdwan` jamais peuplé depuis phase 6.5) ; (b) des ajouts (FK `assetId`, nouveaux modèles SD-WAN) ; (c) de la cohérence UX (Combobox, currency).

---

## Lots livrés

### Lot 1 — Terminologie « Structurée » retirée
- Une seule occurrence runtime à l'utilisateur (CardHeader `ConnectivityLinksManager`).
- Les refs historiques (CHANGELOG, PROJECT_STATUS) conservées — contexte valide.

### Lot 2 — ConnectivityLink.assetId + EnumLabel.isConnectivityCapable
- **Schema** : FK `ConnectivityLink.assetId` → `Asset` (nullable, `onDelete: SetNull`) + inverse `Asset.connectivityLinks`. Index `@@index([assetId])`.
- **EnumLabel** : nouvelle colonne `isConnectivityCapable Boolean @default(false)`. Built-in defaults `true` pour ROUTER / FIREWALL / BOX_5G / SWITCH (`backend/src/modules/admin/admin.service.ts:DEFAULT_LABELS`).
- **DTO / Service back** : `CreateConnectivityLinkDto.assetId?`, validation `validateAssetForSite` (asset.siteId doit matcher link.siteId). Include asset dans `LINK_INCLUDE`.
- **Seed** : wire des firewalls PRIMARY par site démo (DEF/SAC/VEL/STC/MAS/BOU) via `primaryAssetBySite` map.
- **Frontend** : types `ConnectivityLink.assetId` + `asset?` enrichis, field Combobox "Équipement associé" dans `ConnectivityLinksManager` dialog, affichage read-only dans chaque row (lien cliquable vers asset).
- **Zéro JSON.** FK + contraintes + index.

### Lot 3 — SD-WAN en modèles Prisma structurés
- **Schema** : nouveaux modèles
  ```prisma
  SdwanConfig (1:1 Site, + tenantId, enabled, provider, monitorName, status, notes)
  SdwanFirewall (N:1 SdwanConfig, N:1 Asset, role)
  ```
- Relations inverses : `Site.sdwanConfig SdwanConfig?`, `Asset.sdwanRoles SdwanFirewall[]`, `Tenant.sdwanConfigs`.
- **Module NestJS `backend/src/modules/sdwan/`** : `SdwanService` (upsert config, attach/detach firewall avec validation siteId), `SdwanController` endpoints RBAC-scopés (`@RequireRead/Write/Manage`), DTOs class-validator. Registered dans `app.module.ts`.
- **Refacto `HealthAggregationService`** : signature `calculateSiteHealth(links, sdwanConfig, assets, monitorMap)` (vs anciennement 3 args). Le champ `v2.sdwan` (jamais peuplé depuis phase 6.5 — dette morte) disparaît. Firewalls SD-WAN déduits via FK `sdwanConfig.firewalls[].assetId`, pas par filtrage `asset.type === 'FIREWALL'`.
- **Callers** : `monitoring-webhook.service.ts:135` + `integrations.service.ts:862` mis à jour pour inclure `sdwanConfig: { include: { firewalls: true } }` et passer l'arg.
- **`connectivity-migration.ts`** : `SdwanConfigV2` supprimé, `extractMonitorNames` (inutilisé) supprimé. `ConnectivityV2` allégé.
- **Seed** : `createSdwanConfigsForDemo` — 5 configs (DEF avec 2 FortiGate HA active/passive, SAC/VEL/STC/MAS avec 1 FortiGate active). Reset wipe cascade SdwanFirewall + SdwanConfig.
- **Frontend** : `lib/api/sdwan.ts` client, composant `<SdwanSection>` intégré dans la fiche site (Infos pratiques) — affichage config + firewalls, dialogs Attach/Detach/Configure avec RBAC.

### Lot 4 — EntitySelectCombobox générique virtualisé
- **Deps ajoutées** (package.json) : `@radix-ui/react-popover ^1.1.14`, `cmdk ^1.1.1`, `@tanstack/react-virtual ^3.13.12`.
- **Composants UI shadcn-style** : `ui/popover.tsx`, `ui/command.tsx`.
- **`ui/entity-select-combobox.tsx`** : générique typé, recherche full-text (sur `searchText` fallback `label`), virtualisation via `useVirtualizer` au-delà de 50 items, a11y (aria-*, Focus trap via Radix Popover), keyboard nav via cmdk. Props : options, value, onChange, placeholder, searchPlaceholder, emptyMessage, clearable, ariaLabel, id, render custom.
- **Remplacements migrés (10 selects)** :
  - ConnectivityLink dialog : assetId
  - SD-WAN AttachFirewall : assetId
  - tasks/new + tasks/[id]/edit : siteId, assetId, assignedTo (×6)
  - floor-plans/new : siteId
  - floor-plans/[id] pin dialog : assetId
  - costs/new : bearerId, assetId (×2)
  - costs/[id]/edit : bearerId
- **Non migrés (fonctionnel OK)** : `GroupedSiteSelector` (déjà searchable + groupé par délégation), selects d'enums fixes (priority/status/type), `VendorCombobox` (combobox custom avec scoping delegationId déjà correct).

### Lot 5 — P1 cascades restantes
- **sites/new étape 3 allContacts** : scope sur `formDelegationId` (watch du form lui-même, pas l'active delegation), queryKey rebuild.
- **sites/new étape 2 providerContacts** : même scoping appliqué.
- **budgets/page sites form** : passage `delegationId` au fetch (back-filtered, plus de client-side filter sur 500 items).
- **VendorCombobox** : audité — scoping correct (`delegationId` + `includeGlobal` déjà passés correctement, queryKey rebuild OK).

### Lot 6 — Cohérence formatage currency
- **Helper central** `frontend/src/lib/currency.ts` : `formatCurrency(amount, currency, opts)` + `formatMonthlyPrice(amount, currency)` (suffixe `/mois`). Fallback robuste si devise invalide.
- **Remplacements** : `costs/page.tsx` (helper local supprimé), `costs/reports/page.tsx` (helper local supprimé), `costs/new` + `costs/[id]/edit` (allocation preview), `costs/budgets` (4 usages : totalBudgeted, totalSpent, status.spent/.budgeted, Dépassement), `consumption/page` (2), `consumption/[siteId]/page`, `ConnectivityLinksManager` (monthlyPrice → `formatMonthlyPrice`), `assets/[id]/page` (linked expenses), `expenses/ResyncExpenseButton`, `expenses/GenerateExpenseToggle`.
- **Règles** : plus de `.toFixed(2) + ' EUR'` ad-hoc, plus de `toLocaleString + ' EUR'` ad-hoc, plus d'Intl.NumberFormat en dur. Tout routé via `formatCurrency`.

### Lot 7 — UX sites/new 2-temps + deep-link Infos pratiques
- **STEPS** : réduit de 3 à 2 (« Informations de base » + « Contacts & Accès »). Connectivité retirée du wizard.
- **État supprimé** : `connectivityLinks`, `addLink`, `removeLink`, `updateLink`, `providerContacts` query, `CONNECTIVITY_TYPES` constant, `cutProcedure` du schema zod, defaultValues `connectivity: {...}`, payload building de `connectivity` dans onSubmit.
- **Flow** : post-création, redirect direct vers `/dashboard/sites/[id]?tab=practical` + toast sonner avec action "Infos pratiques" (duration 8s). La fiche site détecte `?tab=practical` → `activeTab = 'infos-pratiques'`.
- **Infos pratiques** : déjà sans mention « Structurée » (Lot 1). Contient désormais : Ressources & Partages, Contacts, Connectivité (ConnectivityLinksManager), SD-WAN (SdwanSection).

---

## Fichiers touchés (sommaire)

### Schema
- `backend/prisma/schema.prisma` : +2 modèles (SdwanConfig, SdwanFirewall), +1 champ EnumLabel (isConnectivityCapable), +1 champ ConnectivityLink (assetId + asset relation + index), +3 relations inverses (Tenant.sdwanConfigs, Site.sdwanConfig, Asset.sdwanRoles + connectivityLinks).

### Backend
- `backend/src/modules/sdwan/` (nouveau) : module, service, controller, DTOs.
- `backend/src/app.module.ts` : register SdwanModule.
- `backend/src/modules/admin/admin.service.ts` : `DEFAULT_LABELS` enrichi avec `connectivityCapable`, `getEnumLabels` merge, `updateEnumLabel` accepte `isConnectivityCapable`.
- `backend/src/modules/admin/dto/update-enum-label.dto.ts` : +`isConnectivityCapable?`.
- `backend/src/modules/connectivity/dto/create-connectivity-link.dto.ts` : +`assetId?`.
- `backend/src/modules/connectivity/connectivity.service.ts` : `validateAssetForSite`, include asset, create/update handle assetId.
- `backend/src/common/utils/connectivity-migration.ts` : supprime `SdwanConfigV2`, `extractMonitorNames`, simplifie types.
- `backend/src/modules/integrations/health-aggregation.service.ts` : nouvelle signature avec `sdwanConfig` en arg séparé, SD-WAN block refactoré (FK-driven, pas type-driven).
- `backend/src/modules/integrations/services/monitoring-webhook.service.ts` : fetch sdwanConfig, pass to health calc.
- `backend/src/modules/integrations/integrations.service.ts` : idem pour syncAllSitesHealth.
- `backend/src/modules/seed/seed.service.ts` : `createSdwanConfigsForDemo`, enrichissement `createConnectivityLinksForDemo` avec `primaryAssetBySite`, reset handle sdwanFirewall + sdwanConfig.

### Frontend
- `frontend/package.json` : +3 deps.
- `frontend/src/components/ui/popover.tsx` (nouveau)
- `frontend/src/components/ui/command.tsx` (nouveau)
- `frontend/src/components/ui/entity-select-combobox.tsx` (nouveau)
- `frontend/src/components/sdwan/SdwanSection.tsx` (nouveau)
- `frontend/src/components/connectivity/ConnectivityLinksManager.tsx` : retrait "(structurée)", field assetId + Combobox, affichage row asset, formatMonthlyPrice.
- `frontend/src/lib/api/sdwan.ts` (nouveau)
- `frontend/src/lib/api/connectivity.ts` : +assetId + asset?.
- `frontend/src/lib/api/admin.ts` : +isConnectivityCapable.
- `frontend/src/lib/currency.ts` (nouveau)
- `frontend/src/app/dashboard/sites/[id]/page.tsx` : import SdwanSection, useSearchParams pour `?tab=practical`.
- `frontend/src/app/dashboard/sites/new/page.tsx` : wizard 2-temps, toast post-création, zod cleanup.
- `frontend/src/app/dashboard/tasks/new/page.tsx` + `tasks/[id]/edit/page.tsx` : 3 Combobox chacun.
- `frontend/src/app/dashboard/floor-plans/new/page.tsx` : Combobox site.
- `frontend/src/app/dashboard/floor-plans/[id]/page.tsx` : Combobox asset (pin dialog).
- `frontend/src/app/dashboard/costs/new/page.tsx` + `costs/[id]/edit/page.tsx` : Combobox bearer + asset, formatCurrency.
- `frontend/src/app/dashboard/costs/page.tsx` : helper local supprimé.
- `frontend/src/app/dashboard/costs/reports/page.tsx` : helper local supprimé.
- `frontend/src/app/dashboard/costs/budgets/page.tsx` : site fetch scopé délégation, 4 formatCurrency.
- `frontend/src/app/dashboard/consumption/page.tsx` + `consumption/[siteId]/page.tsx` : formatCurrency.
- `frontend/src/app/dashboard/assets/[id]/page.tsx` : formatCurrency.
- `frontend/src/components/expenses/ResyncExpenseButton.tsx` + `GenerateExpenseToggle.tsx` : formatCurrency.

### Docs
- `docs/decisions/adr-013-residual-json-debt.md` (nouveau)
- `reports/phase6.6-cleanup.md` (ce fichier)

---

## Commandes deploy

```bash
# Local — déjà fait : commit + push par lot atomique
git log --oneline main..HEAD

# Serveur
ssh xch-deploy
cd /opt/xch-dev/XCH
git pull
cd backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss  # nouveaux modèles SdwanConfig/SdwanFirewall, +1 col EnumLabel, +1 col ConnectivityLink
# Reset + reseed (données démo uniquement — pas de perte réelle)
# via l'UI admin ou directement :
#   curl -X POST .../api/seed/reset (admin)
#   curl -X POST .../api/seed/load  (admin)
cd ../frontend
npm install
npm run build
# redémarrer les services (pm2 / systemd)
```

## Smoke tests post-deploy

1. Login → fiche site DEF-01 → onglet Infos pratiques.
2. Vérifier que la card "Connectivité" ne mentionne plus "(structurée)".
3. Vérifier que chaque lien PRIMARY affiche son équipement (firewall Fortinet).
4. Vérifier la nouvelle section "SD-WAN" : 2 firewalls listés pour DEF (active/passive), provider "Fortinet SD-WAN".
5. Cliquer "Ajouter un firewall" → Combobox searchable avec seulement les équipements compatibles du site.
6. Edit un ConnectivityLink → field "Équipement associé" Combobox, peut sélectionner / effacer.
7. /dashboard/sites/new → wizard 2 étapes (plus d'étape Connectivité).
8. Post-création → toast "Site créé. Ajoutez maintenant sa connectivité." + landing direct sur Infos pratiques.
9. /dashboard/tasks/new → Combobox site / asset / assignedTo searchable.
10. /dashboard/costs → currency formaté uniformément (€ en devise, séparateurs FR).

## Dette résiduelle tracée

Voir ADR-013. **Séquencement imposé :**

1. Phase 6.6 déployée + validée (cette phase).
2. **Session monitoring native** — touche l'asset (monitors, status, notifications). Passe avant tout refacto Asset.
3. Session `NotificationConfig` → à réévaluer après monitoring (probable impact).
4. Session `Asset.networkInfo` partie réseau pur (`ip/mac/hostname/vlan/port/adminLinks`) → **post-monitoring**, pour ne pas retoucher l'asset deux fois (rappel user 2026-04-20).

---

**Fin du rapport.**
