# Prompt de session — Cohérence formulaires XCH (phase 6.6)

**À utiliser tel quel en ouverture de session.** Self-contained — la session charge sa mémoire MCP classique, les 5 docs root (PROJECT_STATUS, CHANGELOG, CLAUDE, DEVELOPMENT_LOG, 00-INDEX), et ce prompt suffit pour démarrer sans exploration préalable.

---

## Prompt à copier/coller

```
Reprise : cohérence formulaires et UX XCH (phase 6.6).

PRINCIPE DIRECTEUR XCH (valable pour toute cette session ET pour toutes
les sessions futures — c'est une règle du projet énoncée par l'utilisateur
le 2026-04-20) :

  "Toujours faire propre, pas de dette technique.
   L'app doit être développée selon les règles de l'art d'aujourd'hui.
   Harmoniser, cohérence, effacer toute dette — sans négliger la sécurité."

Conséquences concrètes et non-négociables pour le code :
  - Pas de champ JSON "sac à tout" quand un modèle Prisma structuré
    peut porter la sémantique (FK, contraintes, index, query). La dette
    technique cumulée des "Tenant.config.xxx", "Site.metadata.yyy",
    "Asset.networkInfo" doit se réduire avec le temps, pas grandir.
  - Pas de "on verra plus tard", pas de "provisoire". Si une décision
    pose une dette, on choisit l'option qui n'en pose pas, même si le
    scope augmente.
  - Type-safety bout en bout (TypeScript strict, Prisma enums, zod
    alignés avec DTOs class-validator).
  - Sécurité par défaut : décorateurs @Require*, validation inputs,
    pas de secret en clair, RBAC scopé, rate-limiting, échappement
    XSS/SQL. Aucune régression tolérée.
  - UX : composants réutilisables (pas de copier-coller), accessibilité
    de base (aria-label, htmlFor, focus trap), labels FR cohérents via
    les helpers existants.

Cette règle prend le pas sur la vitesse. Si un choix rapide crée de la
dette, on prend l'option plus longue qui la supprime.


ÉTAT À LA FIN DE LA SESSION PRÉCÉDENTE
---------------------------------------
- Phase 6.5 livrée : Site.connectivity JSON droppé ; ConnectivityLink
  table est source de vérité. Backend refactor complet (health,
  webhook, integrations, backup, seed). Frontend : <SiteConnectivity
  Section> retiré, seul <ConnectivityLinksManager> affiche les liens.
  14 rows seedés (primary + backup sur 7 sites).
- 3 P0 cascade fixés : tasks/new, floor-plans/new, costs/new scopent
  désormais leurs Selects sur la délégation active (+ asset fetch
  lazy sur siteId).
- Monitoring natif : ADR-012 Gatus bidir abandonné. Prompt séparé pour
  la future implémentation module natif (docs/prompts/next-session-
  monitoring-native.md) — sera traité dans une session dédiée.
- Branch claude/mystifying-yalow-ebe6ab alignée avec main, tout push.

CE QUI RESTE — LES 4 POINTS À TRAITER
--------------------------------------

## 1. ConnectivityLink : équipement associé + cohérence formulaires

### 1a. Terminologie
- Retirer partout le mot "Structurée" / "(Structurée)" du titre de la
  section connectivité dans la fiche site. Motivation utilisateur :
  "pas pro". Grep attendu :
    frontend/src/components/connectivity/ConnectivityLinksManager.tsx
    (titre de la CardHeader).

### 1b. Champ "Équipement associé" manquant
- Le schema Prisma ConnectivityLink N'A PAS de FK assetId. Ajouter :
    assetId String?
    asset   Asset? @relation(fields: [assetId], references: [id], onDelete: SetNull)
  + index et relation inverse sur Asset.connectivityLinks[].
- Dans ConnectivityLinksManager.tsx :
  - Dialog create/edit : ajouter un <Select> "Équipement associé
    (routeur FAI / firewall)" filtré aux assets du site (scope siteId)
    avec type ∈ {ROUTER, FIREWALL, BOX_5G} (à affiner — voir sous-décision).
    Optionnel.
  - Affichage par row : mentionner le nom de l'asset associé si présent.
- Refacto `normalizeConnectivity` (backend/src/common/utils/
  connectivity-migration.ts) pour propager `assetId` dans le V2 shape
  consommé par HealthAggregationService.
- DTO `CreateConnectivityLinkDto` : ajouter `assetId?: string` optional.

### 1c. Partie prix absente du formulaire sites/new
- **DÉCISION ACTÉE (2026-04-20)** : **deux temps**. Un site peut exister
  sans connectivité configurée. Après création, l'utilisateur ouvre
  `/dashboard/sites/[id]` onglet Infos pratiques et ajoute les liens
  (+ prix) via `<ConnectivityLinksManager>`.
- Nettoyage : dans l'étape 2 actuelle du wizard sites/new, retirer les
  champs legacy (primary/backup/type/provider JSON-style) s'ils existent
  encore — l'étape 2 ne doit plus évoquer la connectivité, uniquement
  l'adresse / coordonnées / accès.
- UX : à la fin de la création du site, afficher un toast "Site créé.
  Ajoutez maintenant sa connectivité." avec un lien direct vers la
  fiche Infos pratiques.

### 1d. Cohérence globale prix dans l'app
- L'utilisateur mentionne : "il faut être cohérent sur tout l'app XCH
  et tout les formulaires".
- Grep des endroits où un prix / monthlyPrice est affiché sans être
  uniforme (formatage, devise, badge). Helper déjà partiellement
  centralisé dans frontend/src/lib/decimal-input.ts et helpers
  Intl.NumberFormat — auditer qu'ils sont utilisés partout.
- Tout ce qui affiche "X EUR" ou "X €" ou "X.XX" de façon ad-hoc :
  normaliser via new Intl.NumberFormat('fr-FR', {style:'currency',
  currency:'EUR'}).

## 2. Site DEF-01 : firewalls invisibles dans ConnectivityLink /
      SD-WAN (reliquat JSON retiré phase 6.5)

### Analyse rapide
- Avant phase 6.5 : Site.connectivity.sdwan.firewallIds et
  connectivity.links[i].assetId étaient écrits par le seed post-
  création d'assets (méthode createSites / createAssets).
- Phase 6.5 : supprimé ces mutations sans migrer vers ConnectivityLink.
- Résultat : les 2 FortiGate du site DEF-01 n'ont plus de lien
  métier vers aucun ConnectivityLink → invisibles dans l'UI, bug
  visuel sur la fiche.

### Fix
1. Dans le seed : après createAssets, faire une passe qui :
   - Pour DEF-01, lie le lien PRIMARY (Orange Business) au firewall
     FGT100F-DEF-001 via ConnectivityLink.assetId.
   - Pour SAC-01, lie le PRIMARY au firewall FGT80F-SAC-001.
2. SD-WAN : v1.3 SD-WAN vivait dans connectivity.sdwan.firewallIds
   (JSON). Phase 6.5 ne l'a pas migré. **DÉCISION ACTÉE (2026-04-20) :
   modèle Prisma structuré, pas de JSON.**

   Nouveau schema :
     model SdwanConfig {
       id          String   @id @default(cuid())
       tenantId    String
       tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
       siteId      String   @unique  // 1:1 avec Site (une config SD-WAN par site)
       site        Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
       enabled     Boolean  @default(true)
       provider    String?  // "Fortinet SD-WAN", "Cisco Meraki", etc.
       monitorName String?
       status      String?  // 'up' | 'down' | 'degraded' | 'unknown'
       notes       String?  @db.Text
       createdAt   DateTime @default(now())
       updatedAt   DateTime @updatedAt
       firewalls   SdwanFirewall[]
       @@index([tenantId])
       @@map("sdwan_configs")
     }

     model SdwanFirewall {
       id             String       @id @default(cuid())
       sdwanConfigId  String
       sdwanConfig    SdwanConfig  @relation(fields: [sdwanConfigId], references: [id], onDelete: Cascade)
       assetId        String
       asset          Asset        @relation(fields: [assetId], references: [id], onDelete: Cascade)
       role           String?      // 'active' | 'passive' | 'peer'
       createdAt      DateTime     @default(now())
       @@unique([sdwanConfigId, assetId])
       @@index([sdwanConfigId])
       @@index([assetId])
       @@map("sdwan_firewalls")
     }

   + relations inverses sur Site (`sdwanConfig SdwanConfig?`) et
   Asset (`sdwanRoles SdwanFirewall[]`).

   Service/module NestJS `backend/src/modules/sdwan/` :
     - SdwanService : CRUD + attach/detach firewall
     - SdwanController : endpoints scopés `@RequireWrite()` sur le site
       - PUT /sdwan/:siteId (upsert config)
       - POST /sdwan/:siteId/firewalls (attach asset firewall)
       - DELETE /sdwan/:siteId/firewalls/:assetId
       - GET /sdwan/:siteId (retourne config + firewalls avec leurs
         metadata monitoring)
     - DTOs : CreateSdwanConfigDto, AttachFirewallDto, class-validator
       à jour.

   Zéro dette : pas de JSON, FK partout, unique sur siteId, cascade
   propre, RBAC scopé, index pour les lookups fréquents.

3. Le HealthAggregationService.calculateSdwanHealth consomme à présent
   `SdwanConfig` + `SdwanFirewall[]` (via Prisma include) au lieu de
   `v2.sdwan.firewallIds`. La fonction `normalizeConnectivity` n'a
   plus à exposer sdwan — elle ne traite que les links. Refacto
   signature de `calculateSiteHealth` pour recevoir sdwanConfig en
   paramètre séparé.

4. Seed v1.4.x : pour DEF-01 et SAC-01 existants avec 2 FortiGate,
   créer la SdwanConfig + 2 SdwanFirewall rows post-création d'assets.
   + frontend UI section "SD-WAN" sur la fiche site (Infos pratiques)
   avec badges des firewalls + status monitoring agrégé.

## 3. Selects searchable partout (UX critique à 250+ items)

### Problème
- Les shadcn <Select> natifs (Radix) n'ont pas de recherche intégrée.
  Pour un site avec 250 équipements, 80 contacts, etc., c'est
  inutilisable.
- À impacter : quasiment tous les formulaires existants (tasks/new,
  assets/new, contacts/new, costs/new, racks/new, floor-plans pin
  asset assoc, ConnectivityLinksManager nouveau assetId, etc.).

### Solution
Utiliser **shadcn <Combobox>** (Command + Popover) pour tous les Selects
d'entités à volumétrie potentiellement grande. shadcn a le pattern
exact documenté. Composants impliqués :
- @radix-ui/react-popover (à ajouter si absent)
- cmdk (à ajouter)
- shadcn-generated `combobox.tsx` (générer via CLI ou copier depuis
  la doc shadcn).

### Approche recommandée
1. Ajouter un composant réutilisable `<EntitySelectCombobox>` :
   - Props : options (rendu custom — icone/nom/code/badge), value,
     onChange, placeholder, searchPlaceholder, emptyMessage,
     renderOption, virtualScroll (opt pour 1000+ items).
   - Recherche full-text sur nom + code.
   - Multi-sélection optionnelle (flag multi=true).
2. Remplacer progressivement les <Select> des formulaires suivants
   (liste non-exhaustive — à affiner à la lecture) :
   - tasks/new : site, asset, assignedTo
   - tasks/[id]/edit : même
   - assets/new : site, delegationId, rack, AssetModel
   - contacts/new : typeId (en Combobox groupé par catégorie)
   - costs/new : bearerId (BillingEntity), assetId, vendorId
   - racks/new + edit : site
   - floor-plans/new : site
   - floor-plans/[id]/page.tsx pin dialog : asset
   - ConnectivityLinksManager dialog (nouveau champ assetId — cf. 1b)
3. Laisser les Selects fixes (enum status, priority, kind) tels
   quels — la recherche n'apporte rien.

### Sous-décision
- **DÉCISION ACTÉE (2026-04-20)** : "on a tout le temps qu'il faut pour
  bien faire". Donc virtualisation **oui dès la v1** via
  `@tanstack/react-virtual` pour le composant `<EntitySelectCombobox>`.
  Même si la volumétrie pilote est < 500 items, un outil de gestion IT
  chantiers qui grandit passera les 1000 rapidement. Faire propre
  maintenant pour ne pas redévelopper plus tard.
- Tests avec jeu de données artificiel à 2000 items — viewport doit
  rester fluide (<16ms par scroll).

## 4. P1 cascade restants (phase 6.5 audit)

Identifiés dans reports/phase6-audit-frontend-v1.4.md et dans le
commit `fbed82a` (mentionnés en "Not fixed"):
- **sites/new étape 3** : `allContacts` fetch tenant-wide. Filtrer
  par delegationId active via DelegationContext.
- **budgets/page** form inline : sites fetch tous (queryKey rebuild
  OK mais inefficace). Passer delegationId au fetch.
- **costs/new VendorCombobox** : vérifier que le prop `delegationId`
  (passé ligne ~239) filtre bien les vendors côté fetch dans l'impl
  interne du composant. Si non, corriger.

## SOUS-DÉCISIONS

1. **Connectivité à la création du site (1c)** : **ACTÉ — deux temps.**
   Le site peut exister sans connectivité configurée.
2. **SD-WAN stockage (2)** : **ACTÉ — modèles Prisma structurés
   (SdwanConfig + SdwanFirewall), zéro JSON.**
3. **Combobox virtualisé (3)** : **ACTÉ — virtualisation via
   @tanstack/react-virtual dès la v1.**
4. **Types d'assets éligibles sur un ConnectivityLink.assetId** :
   filtrer par défaut à { ROUTER, FIREWALL, BOX_5G, SWITCH } avec
   toggle "Tous les équipements" pour cas exotiques. À confirmer en
   début de session si l'utilisateur veut ajuster la liste.

## ORDRE D'EXÉCUTION PROPOSÉ

Lot 1 (~30 min) — Terminologie "Structurée" retirée partout.

Lot 2 (~1h30) — ConnectivityLink.assetId :
  - Schema : ajouter FK + relation inverse Asset.connectivityLinks.
  - CreateConnectivityLinkDto + UpdateConnectivityLinkDto : assetId?.
  - normalizeConnectivity : propager assetId dans V2 shape.
  - ConnectivityLinksManager dialog : nouveau Select Combobox
    (cf. Lot 4) filtré par siteId + types éligibles.
  - Affichage par row : nom de l'asset lié si présent.

Lot 3 (~3h) — SD-WAN modèle Prisma structuré :
  - Schema : SdwanConfig + SdwanFirewall (1:1 site, N:1 firewalls).
  - Module NestJS sdwan/ : service + controller + DTOs + RBAC.
  - Endpoints : PUT /sdwan/:siteId, POST/DELETE /firewalls, GET.
  - HealthAggregationService : refacto signature pour recevoir
    sdwanConfig + firewalls en paramètre séparé (normalizeConnectivity
    ne traite plus sdwan).
  - Seed : SdwanConfig pour DEF-01 + SAC-01, SdwanFirewall rows
    pour les FortiGate existants.
  - UI Infos pratiques : section "SD-WAN" avec provider, status
    agrégé, badges firewalls. Edit dialog pour attach/detach.

Lot 4 (~3h30) — EntitySelectCombobox virtualisé :
  - Ajout deps : @radix-ui/react-popover, cmdk, @tanstack/react-virtual.
  - Composant <EntitySelectCombobox<T>> : props génériques typées,
    recherche full-text nom+code, virtual scroll, loading state,
    empty state, a11y complète (role, aria-labels, focus trap).
  - Tests manuels à 2000 items fictifs : scroll 60fps.
  - Remplacement dans ~12 formulaires prioritaires (liste dans le
    prompt, Lot 4 détaillé plus bas).

Lot 5 (~45 min) — P1 cascade restants : sites/new step 3 allContacts
  scopé delegation, budgets/page site fetch scopé, audit
  VendorCombobox (lire son impl et s'assurer que delegationId filtre
  bien — corriger sinon).

Lot 6 (~1h) — Cohérence formatage currency + prix :
  - Audit : grep des usages Intl.NumberFormat / € / EUR ad-hoc.
  - Nouveau helper <Currency amount={X} currency={Y} /> +
    utilitaire formatCurrency(amount, currency) pour les usages hors
    JSX (export-site PDF, alerts, toasts).
  - Remplacement systématique partout — zéro formatage manuel.

Lot 7 (~30 min) — UX sites/new deux-temps propre :
  - Retirer toute mention connectivity/prix de l'étape 2 du wizard.
  - Toast post-création avec lien "Ajoutez maintenant sa connectivité"
    vers /sites/[id] onglet Infos pratiques.
  - Sous-titre de la page Infos pratiques : "Connectivité, contacts,
    ressources et accès" (retirer "Structurée").

Lot 8 (~45 min) — Deploy + tests :
  - prisma db push --accept-data-loss (nouvelles tables SdwanConfig,
    SdwanFirewall).
  - Reset + reseed DB.
  - Curl : vérifier ConnectivityLink.assetId rendu, SdwanConfig
    présent pour DEF-01/SAC-01, combobox searchable visuellement,
    P1 cascades corrigés.
  - Rapport court phase 6.6 au format phase 5/6.

Charge totale estimée : ~10-11h pour tout finir proprement.

WORKFLOW
--------
1. Audit rapide (20 min) : lire les fichiers cités ci-dessus pour
   confirmer les volumes de refacto.
2. Demander à l'user : validation des 4 sous-décisions ci-dessus.
3. Exécution en commits atomiques par lot.
4. Un seul rebuild frontend à la fin (les changes back sont juste
   schema + 1 DTO).
5. Tests fumée curl : GET /sites/:id retourne bien les assets liés
   aux ConnectivityLink, nouveau Combobox searchable visible
   visuellement.

CONTRAINTES
-----------
- Données démo uniquement → reset DB + reseed OK si besoin.
- Pas de rebuild intermédiaire.
- Backward compat : les formulaires continuent de fonctionner pendant
  le refacto (Combobox remplace <Select> mais onChange garde même
  signature).

Fin du prompt. Réponds par "OK, je lis les 4 fichiers cités et
je reviens avec les sous-décisions commentées" et on démarre.
```

---

## Résumé pour toi

Contenu du prompt — les 4 points utilisateur détaillés + sous-décisions à trancher + plan en 8 lots (~8-9h). Le prompt est auto-suffisant : une nouvelle session le lit, charge la mémoire MCP, lit les 5 docs root, et peut démarrer.

Points spécifiques qui méritent ton attention :
- **Sous-décision 1 (connectivité inline au site/new)** : choix UX important, à trancher tôt.
- **Sous-décision 2 (SD-WAN storage)** : entre JSON dans metadata (simple) et table Prisma (propre mais dette). V1 recommandée JSON.
- **Combobox searchable (lot 4)** : plus gros refacto, touche ~10 formulaires. C'est de la plomberie utile mais chronophage.
- Les P1 cascade (lot 5) ne sont pas urgents — bloquable si manque de temps.
