# Prompt — finalisation v1.6 (S5 + UX globale + S6/S7)

Reprise après les sessions monitoring natif (ADR-014 + ADR-016) et S1
sécurité (ADR-015). On termine le plan v1.6 du projet.

PRINCIPE DIRECTEUR XCH (règle projet, énoncée 2026-04-20, applicable à
toutes les sessions) :

  "Toujours faire propre, pas de dette technique.
   L'app doit être développée selon les règles de l'art d'aujourd'hui.
   Harmoniser, cohérence, effacer toute dette — sans négliger la sécurité."

État actuel (2026-04-27)
------------------------

Plan v2 / vers v1.6 :
- ✅ S0 — bump 1.3.0 → 1.5.0 + deploy parity (commits `eaa8880`, `7201bfa`)
- ✅ S1 — sécurité S1-A + S1-B + S1-closing + S1-closing-2
  ([ADR-015](../decisions/adr-015-s1-security-hardening.md))
- ✅ S4 — tests Jest critical paths (commit `0118c8b`)
- ✅ S2 — monitoring natif ([ADR-014](../decisions/adr-014-native-monitoring.md))
  + suppression Gatus/Kuma + UX produit
  ([ADR-016](../decisions/adr-016-monitoring-unification.md))
- ⏳ **S5** — migrations Prisma versionnées (PRÉREQUIS bloquant pour S6/S7)
- ⏳ **UX globale** — tournée audit jargon / vocabulaire / hiérarchie sur
  toutes les pages (page /notifications dans menu, empty states, etc.)
- ⏳ **S6/S7** — refacto JSON résiduel ([ADR-013](../decisions/adr-013-residual-json-debt.md))

Une fois S5 + S6/S7 livrés → tag **v1.6.0**.

Tag actuel : `v1.5.0`. Les commits sur `main` depuis ce tag sont
v1.6-en-cours.

Ordre recommandé pour cette session
-----------------------------------

**Tu choisis UNE des 3 options ci-dessous selon le temps dispo et l'envie :**

### Option A — S5 Prisma migrations (~3-4h, technique pur, débloque S6/S7)

Aujourd'hui le déploiement utilise `prisma db push --accept-data-loss`
dans `backend/docker-entrypoint.sh`. C'est OK en dev éphémère mais :

- Aucune historisation des changements de schéma → impossible de rollback.
- Aucune CHECK constraint native (les ajouts vivent dans
  `backend/prisma/post-push.sql`, pas dans le `schema.prisma` versionné).
- Les drops de colonnes (ADR-013, ADR-016) tournent en dev silencieusement,
  on perd la trace.
- S6/S7 devraient tourner en migrations propres pour que les renames /
  drops soient revertibles.

**Cible** :
- Convertir le projet en `prisma migrate` versionné.
- Initialiser la baseline avec une migration `0_init` qui reflète l'état
  schéma courant.
- Migrer les CHECK constraints de `post-push.sql` dans une migration
  ad-hoc (ou un fichier de migration manuelle).
- Adapter `docker-entrypoint.sh` :
  `prisma migrate deploy` au lieu de `prisma db push`.
- Adapter le worker entrypoint (skip migrate, attendre l'API comme avant).
- Documenter le workflow dev :
  `npm run prisma:migrate -- --name <description>` pour créer une
  migration locale, commit le dossier généré.
- Mettre à jour `package.json` scripts (`db:push` retiré ou marqué dev-only).
- ADR-017 : documente le passage `db push` → `migrate deploy`, le pattern
  de migration manuelle pour les CHECK + extensions PostGIS, et la
  procédure de rollback.

**Pièges connus** :
- L'extension `postgis` (utilisée par `Site.coordinates Unsupported(...)`)
  ne se gère pas via Prisma migrations natif → doit rester dans une
  migration manuelle qui fait `CREATE EXTENSION IF NOT EXISTS postgis`
  AVANT la création des colonnes geometry.
- Le seed démo dépend de la base reset — vérifier que reset+migrate+seed
  fonctionne en boucle.
- En prod xch-deploy, la base contient déjà les données démo. Soit on
  reset (autorisé, dev) soit on baseline avec
  `prisma migrate resolve --applied 0_init` pour marquer comme déjà
  appliquée et continuer en migrations normales pour la suite. Privilégier
  le reset (plus propre, données dev).

**Charge estimée** : 3-4h dont 1h ADR + 30min smoke prod.

### Option B — UX globale tournée pro (~6-8h, UI pure)

Items remontés par le pilote (sessions précédentes) à terminer :

1. **Page `/dashboard/notifications`** dans le menu principal. Aujourd'hui
   accès uniquement via la cloche en haut à droite (vue limitée, pas de
   filtres). Une page dédiée avec :
   - Liste paginée des `UserNotification` (déjà en table Prisma, ADR-009).
   - Filtres par event type / canal / lu/non-lu / date.
   - Bouton "Tout marquer comme lu".
   - Gestion bulk (ack plusieurs en une fois).
   - Empty state correct.

2. **Audit jargon technique partout dans l'UI** au-delà du monitoring :
   - "ASSET" / "SITE" / "DELEGATION" en majuscules dans des labels →
     vocabulaire métier.
   - Statuts code (`ACTIVE`, `OUT_OF_SERVICE`, …) → labels métier
     (déjà partiellement fait via `assetStatusLabels`, à étendre).
   - Boutons "Save" / "Delete" → "Enregistrer" / "Supprimer".
   - Toasts d'erreur souvent obscurs (renvoyer le `error.message` brut
     côté frontend).

3. **Cohérence générale** :
   - Vocabulaire UP / DOWN remplacé partout par "Disponible / Indisponible"
     (déjà fait pour le monitoring, à propager partout).
   - Save / Delete / Cancel → uniformiser la couleur et la position des
     boutons de confirmation.
   - Loading states → skeleton plutôt que spinners centrés sur fond blanc.

4. **Empty states** : audit page par page, beaucoup affichent des tables
   vides au lieu d'un empty state cliquable (ex : "Vous n'avez pas
   encore de monitor — Configurez-en depuis la fiche d'un équipement").

5. **Hiérarchie visuelle** sur les pages détail :
   - Asset detail : trop de tabs au même niveau, pas de hiérarchie. Tab
     "Monitoring" mélangée avec Tab "QR Code" — signaler par groupage.
   - Site detail : 9 onglets, certains rarement utilisés. Évaluer un
     "Plus" dropdown pour les onglets secondaires.

6. **Mobile / responsive** : le projet vise iPad/laptop (pas mobile,
   confirmé 2026-04-26), mais quelques pages débordent en < 1024px.
   Audit léger.

**Charge estimée** : 6-8h selon profondeur (pourrait s'étaler sur 2
sessions dédiées à 3-4h chacune).

### Option C — S6/S7 refacto JSON résiduel (~3-4h, NÉCESSITE S5 fait avant)

Si tu fais cette option, S5 doit avoir tourné d'abord (sinon on ne peut
pas dropper proprement les colonnes JSON existantes).

Cibles ([ADR-013](../decisions/adr-013-residual-json-debt.md)) :

1. **`Site.metadata.healthBreakdown`** — JSON dénormalisé écrit par
   l'aggregator. Utile pour l'affichage rapide mais pas indispensable
   structurellement. Soit on le garde (cache lecture, c'est défendable)
   et on l'extrait dans une table cache `SiteHealthBreakdown` (1:1 avec
   Site, columns nommées), soit on le calcule à la demande côté API.
   **Recommandation** : extraire en table `SiteHealthSnapshot` avec un
   champ `componentsJson Json` pour les détails granulaires (tolérable
   car structure variable) + colonnes scalaires `overall`,
   `linksUp`, `linksDown`, `assetsDown`, `sdwanState`, `timestamp`. Donne
   des index queryables sans perdre la flexibilité.

2. **`Site.contacts: Json?`** — array de contacts inline. Doit migrer
   vers la table `Contact` existante avec un FK `siteId`. Aujourd'hui
   `Contact.siteId` existe déjà (relation `contactsOnSite`), donc
   migration = lire le JSON, créer les `Contact` rows manquants, dropper
   la colonne JSON. Audit par site requis pour ne rien perdre.

3. **`Site.accessNotes: Json?`** — `{ schedules, badges, procedures, safety }`.
   Soit table `SiteAccessNote` 1:1 avec colonnes scalaires, soit garder
   en JSON (4 sous-objets stables, faible variabilité). **Recommandation** :
   garder en JSON (stable, peu de queries dessus).

4. **`Site.emplacements: Json?`** — `[{ type, url, description }]`.
   Migrer en table `SiteDocumentEmplacement` avec FK siteId. Aujourd'hui
   c'est consultable mais pas queryable.

5. **`Tenant.config: Json?`** — config branding/appearance/SSO. Zone
   sensible (SSO secrets, branding tokens). **Recommandation** : split
   en 3 tables `TenantBranding`, `TenantAppearance`, `TenantSsoConfig`
   1:1. ADR-010 a déjà préparé `Tenant.allowInternalNetworkTargets` en
   colonne scalaire — continuer le pattern.

6. **`User.appearancePreference: Json?`** — `{theme,primaryColor,density}`.
   Stable, faible variabilité. **Recommandation** : 3 colonnes scalaires
   `appearanceTheme`, `appearancePrimaryColor`, `appearanceDensity`.

7. **`Asset.networkInfo: Json?`** — `{ip, mac, hostname, vlan, port}` +
   adminLinks libres. Le ip/hostname sont déjà queryables via le
   monitor target (auto-sync ADR-016). **Recommandation** : extraire
   `ip`, `mac`, `hostname`, `vlan`, `port` en colonnes scalaires sur
   Asset ; garder `adminLinks: Json?` pour la flexibilité (ADR-013
   acceptait ce JSON-list).

**Charge estimée** : 3-4h pour 4-5 des 7 cibles bien choisies. Pas
besoin de tout faire d'un coup — choisis ce qui apporte le plus de
queryabilité / type-safety.

ADR-018 (ou prolongement ADR-013) à rédiger pour documenter les choix
JSON conservés vs. extraits.

---

Reste secondaire (hors session)
-------------------------------

- **Tests monitoring complémentaires** (lot continu) : `http.probe.spec`,
  `icmp.probe.spec`, `monitor.processor.spec`,
  `health-aggregation.spec`, `monitor-reactions.spec`,
  `safe-lookup.spec`, `safe-http.spec`. À glisser au fil des sessions.
- **Sécurité — chip ouverte** : rotation du PAT GitHub trouvé en clair
  dans `/opt/xch-dev/XCH/.git/config` sur xch-deploy
  (cf. `mcp__ccd_session__spawn_task` du 2026-04-26). 30 min en autonome.
- **Pilote retours réels** : real-time site health, bannière
  auto-disable, auto-sync IP, UX produit nouvellement livrés à
  observer en usage chantier réel. Corriger ce qui sort.

Workflow recommandé
-------------------

1. ADR avant de coder (sauf option B qui n'est pas une décision archi).
2. Commits atomiques par sous-item.
3. Push `main` au fil de l'eau.
4. **Un seul rebuild backend + frontend à la fin.**
5. Smoke tests post-deploy + rapport.

Contraintes
-----------

- Aucune dette technique — les drops doivent être propres, pas de
  `// TODO` ou de hacks.
- L'app reste `production-ready` au fil de l'eau (pas de feature flag
  ni de migration partielle non terminée).
- En option A, `prisma migrate reset` côté dev autorisé. La prod
  xch-deploy est dev en pratique → reset autorisé, baseline depuis le
  schéma courant ne pose pas de problème.
- Cible utilisateurs : laptop / iPad / tablette (PAS mobile-first
  téléphone, validé 2026-04-26).

Avant de coder
--------------

1. Confirmer choix Option A / B / C.
2. Lire l'ADR pertinent (013 / 015 / 016) pour le contexte.
3. Lire `MEMORY.md` pour les règles projet (sources de vérité, deploy
   workflow, accès prod, etc.).

Réponds par "OK, option <X>" et on démarre.
