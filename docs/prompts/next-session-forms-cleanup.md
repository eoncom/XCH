# Prompt de session — Cohérence formulaires XCH (phase 6.6)

**À utiliser tel quel en ouverture de session.** Self-contained — la session charge sa mémoire MCP classique, les 5 docs root (PROJECT_STATUS, CHANGELOG, CLAUDE, DEVELOPMENT_LOG, 00-INDEX), et ce prompt suffit pour démarrer sans exploration préalable.

---

## Prompt à copier/coller

```
Reprise : cohérence formulaires et UX XCH (phase 6.6).

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
- Actuellement sites/new ne propose PAS de configurer les
  ConnectivityLink dès la création. L'user doit créer le site puis
  aller dans /sites/[id] Infos pratiques pour ajouter les liens.
- Décision à prendre : soit **garder ce flow** (deux temps — cohérent
  avec la philosophie "le site existe avant la connectivité"), soit
  **permettre inline à la création** (un petit `<ConnectivityLinks
  Manager>` en étape N+1 du wizard, qui POST /connectivity après le
  POST /sites).
- Recommandation : inline à la création avec un bouton "Ajouter un
  lien" en étape 2 (Connectivité), qui sauve en mémoire et POST à la
  soumission du site. Cohérence avec le besoin utilisateur ("partie
  prix manquante").

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
   (JSON). Phase 6.5 ne l'a pas migré. Deux options :
   - Option A (propre) : nouveau modèle `SdwanConfig` par site
     (enabled, provider, firewallIds array, monitorName).
   - Option B (pragmatique) : champ JSON `Site.metadata.sdwan` qui
     contient cette même structure. Cohérent avec ce qu'on fait
     déjà pour Site.metadata.monitoring.
   - Recommandation : Option B pour v1 (pas de refacto schema),
     migrer en table plus tard si le besoin grandit.
3. Le HealthAggregationService.calculateSdwanHealth lit déjà
   v2.sdwan.firewallIds (in-memory, depuis normalizeConnectivity) —
   adapter pour lire depuis Site.metadata.sdwan côté caller.

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
- Virtualiser la liste (react-virtual ou @tanstack/react-virtual) si
  on s'attend à >1000 items ? Recommandation v1 : non, cmdk gère
  bien jusqu'à ~500. Virtualiser si plaintes ultérieures.

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

## SOUS-DÉCISIONS À VALIDER AVANT IMPL

1. **Connectivité à la création du site (1c)** : inline wizard étape
   ou deux temps ? Reco : inline.
2. **SD-WAN stockage (2)** : Site.metadata.sdwan JSON (reco v1) ou
   nouveau modèle Prisma SdwanConfig ?
3. **Combobox virtualisé (3)** : activer dès maintenant ou non ?
   Reco : non.
4. **Types d'assets éligibles comme "équipement associé"** sur un
   ConnectivityLink : ROUTER / FIREWALL / BOX_5G ? Ou tout asset
   type + pas de filtre strict (l'user choisit) ? Reco : filtrer à
   [ROUTER, FIREWALL, BOX_5G, SWITCH] comme valeurs par défaut,
   avec toggle "Tous types" pour cas exotiques.

## ORDRE D'EXÉCUTION PROPOSÉ

Lot 1 (~30 min) : terminologie "Structurée" retirée.
Lot 2 (~1h) : schema ConnectivityLink.assetId + DTO + normalize
             + ConnectivityLinksManager dialog (Select asset filtré
             par siteId).
Lot 3 (~1h30) : seed DEF-01/SAC-01 liens firewalls + Site.metadata.
              sdwan pour les 2 sites concernés + UI affichage
              badges firewall/SD-WAN.
Lot 4 (~3h) : composant EntitySelectCombobox + remplacement dans
            les 10 formulaires prioritaires.
Lot 5 (~45 min) : P1 cascade restants (sites/new step 3, budgets,
                VendorCombobox audit).
Lot 6 (~45 min) : audit prix dans l'app — formatage currency
                uniforme. Helper <Currency amount=... /> si pattern
                répété >5 fois.
Lot 7 (~30 min) : sites/new étape Connectivité inline (si décision
                1c = "inline"). Skip sinon.
Lot 8 (~30 min) : deploy + tests + rapport.

Charge totale estimée : ~8-9h selon profondeur combobox.

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
