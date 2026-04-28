# Prompt — finalisation v1.6 (S5 + S6/S7 → tag v1.6.0)

Reprise après les sessions monitoring natif (ADR-014 + ADR-016) et S1
sécurité (ADR-015). On termine la dette technique vers le tag **v1.6.0**.

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
- ⏳ **CETTE SESSION : S5 puis S6/S7** (enchaînés, un seul rebuild final).
- 🔮 Session suivante (séparée) — UX/UI globale (jargon, vocabulaire,
  page `/notifications` dans menu, hiérarchie, empty states, etc.).
  Prompt dédié à rédiger en clôture de cette session.

Tag actuel : `v1.5.0`. À la fin de cette session : tag **v1.6.0**.

---

## Plan de la session — S5 puis S6/S7 enchaînés (~6-8h)

S5 doit tourner AVANT S6/S7 pour qu'on ait une infra de migrations
versionnées propre quand on va dropper / renommer les colonnes JSON.

### Phase 1 — S5 : migrations Prisma versionnées (~3-4h)

**Pourquoi** : aujourd'hui le déploiement utilise
`prisma db push --accept-data-loss` dans
`backend/docker-entrypoint.sh`. Conséquences :
- Aucune historisation des changements de schéma → impossible de rollback.
- Aucune CHECK constraint native (les ajouts vivent dans
  `backend/prisma/post-push.sql`, pas dans le `schema.prisma` versionné).
- Les drops de colonnes (ADR-013, ADR-016) tournent en dev silencieusement,
  on perd la trace d'une bonne partie de l'évolution schéma.
- S6/S7 doivent tourner en migrations propres pour que les renames /
  drops soient revertibles.

**Cible** :
1. Convertir le projet en `prisma migrate` versionné.
2. Migration baseline `0_init` qui reflète l'état schéma courant
   (snapshot du `schema.prisma` à `main`).
3. Migration `1_post_push_constraints` qui contient les 3 CHECK de
   `backend/prisma/post-push.sql` (target_exclusive,
   tcp_port_required, interval_bounds) — l'extension `postgis` va aussi
   dans une migration manuelle (CREATE EXTENSION IF NOT EXISTS postgis
   AVANT les colonnes geometry).
4. Adapter `backend/docker-entrypoint.sh` :
   - API : `prisma migrate deploy` au lieu de `prisma db push --accept-data-loss`.
   - Worker : skip migrations comme avant (XCH_MODE=worker → exec node directement).
5. Adapter `backend/package.json` :
   - `db:push` retiré ou marqué dev-only avec warning.
   - Nouveau `db:migrate:dev` (`prisma migrate dev --name <description>`).
   - `db:migrate:deploy` (`prisma migrate deploy`) — utilisé par l'entrypoint.
6. Procédure dev pour créer une migration locale documentée dans le
   README ou `docs/installation/INSTALL_DEV.md`.
7. Supprimer `backend/prisma/post-push.sql` une fois les CHECK migrés.
8. ADR-017 : documente le passage `db push` → `migrate deploy`,
   pattern de migration manuelle pour CHECK + extensions PostGIS,
   procédure de rollback.

**Stratégie de baseline en prod** : la base xch-deploy contient les
données démo seedées. Deux choix :
- **Reset complet** (`prisma migrate reset` puis `migrate deploy` puis
  reseed) — plus propre, données dev éphémères, autorisé par règle
  projet "données courantes = démo".
- **Baseline as-applied** (`prisma migrate resolve --applied 0_init`
  pour marquer la baseline comme déjà appliquée sans la rejouer).

**Recommandation** : reset complet en prod. Plus simple, plus propre,
zéro risque de divergence schéma. Le seed démo recharge tout en 30s.

**Pièges connus** :
- Extension `postgis` (utilisée par `Site.coordinates Unsupported(...)`)
  ne se gère pas via Prisma migrations natif → migration manuelle qui
  fait `CREATE EXTENSION IF NOT EXISTS postgis` AVANT la création des
  colonnes geometry. Ordre : extension d'abord, puis tables.
- Le seed démo dépend de la base reset — vérifier que reset+migrate+seed
  fonctionne en boucle (idempotence du seed déjà acquise via `upsert`).
- `prisma migrate dev` veut écrire un fichier `.sql` dans
  `prisma/migrations/<timestamp>_<name>/migration.sql`. Vérifier que le
  dossier est commité (`.gitignore` ne doit PAS l'exclure).
- Le worker ne doit pas tenter `migrate deploy` (concurrence avec l'API)
  → garder le check `XCH_MODE=worker` dans l'entrypoint.

**Charge S5** : 3-4h dont 30 min ADR + 30 min smoke prod.

### Phase 2 — S6/S7 : refacto JSON résiduel (~3-4h)

**Pourquoi** : la dette JSON identifiée dans
[ADR-013](../decisions/adr-013-residual-json-debt.md) reste partielle
même après les drops déjà faits (ConnectivityLink.{monitorName, status}
+ SdwanConfig.{monitorName, status} en ADR-016 lot E). Les colonnes
restantes ne sont plus queryables, ne sont pas type-safe, et invalident
les contraintes Prisma.

**Cibles à traiter dans CETTE session** (priorisées par impact) :

#### 1. `Asset.networkInfo` (ip, mac, hostname, vlan, port → scalaires)

Aujourd'hui `Asset.networkInfo: Json?` héberge un blob libre
`{ip, mac, hostname, vlan, port, adminLinks}`. Les 5 premiers sont des
champs scalaires stables, queryables, et déjà utilisés par le monitoring
auto-sync (ADR-016 lot H). `adminLinks` est une liste libre `[{label,url}]`
acceptable en JSON (ADR-013 acceptait ce JSON-list).

**Migration** :
- Ajouter `Asset.ip String?`, `Asset.mac String?`, `Asset.hostname String?`,
  `Asset.vlan String?`, `Asset.port String?`.
- Garder `Asset.adminLinks Json?` (list libre).
- Supprimer `Asset.networkInfo`.
- Migration de données : copier `networkInfo.{ip,mac,hostname,vlan,port}`
  vers les colonnes scalaires AVANT le drop (en prod xch-deploy ce sont
  des données démo donc reset+reseed suffit, mais le seed doit produire
  les nouveaux champs).
- Adapter `backend/src/modules/seed/seed.service.ts` (35+ entrées
  d'assets avec networkInfo) pour générer les colonnes scalaires.
- Adapter `assets.service.ts` (auto-sync IP en ADR-016 lot H) pour
  lire `Asset.ip` au lieu de `Asset.networkInfo.ip`.
- Adapter le frontend (assets/[id]/page.tsx, assets/page.tsx,
  MonitorConfigSection.tsx defaultTarget).

**Gain** : index possible sur `Asset.ip`, queryable en filtre, `Tenant.allowInternalNetworkTargets`
peut s'appliquer côté DB en CHECK constraint si on veut.

#### 2. `Tenant.config` split (branding + appearance + SSO)

Aujourd'hui `Tenant.config Json?` héberge `{appearance, branding, sso, …}`.
Trois sous-objets stables, indépendants, dont SSO contient des secrets.

**Migration** :
- Nouvelle table `TenantBranding` 1:1 avec `Tenant` (logoUrl, primaryColor,
  secondaryColor, accentColor, organizationName, securityReminders Json?).
- Nouvelle table `TenantAppearance` 1:1 avec Tenant (theme, primaryColor,
  density, allowUserOverride).
- Nouvelle table `TenantSsoConfig` 1:1 avec Tenant (provider, clientId,
  clientSecret encrypted, callbackUrl, …) — secrets en colonnes scalaires
  encrypted-at-rest si possible (sinon clair pour dev).
- Migration de données depuis `Tenant.config` JSON.
- Drop `Tenant.config`.
- `User.appearancePreference: Json?` → 3 colonnes scalaires
  `appearanceTheme`, `appearancePrimaryColor`, `appearanceDensity`.

**Gain** : type-safety, secrets SSO ne sont plus dans un blob qui
trafique partout, branding queryable.

#### 3. `Site.healthBreakdown` cache (extraction depuis `Site.metadata`)

`Site.metadata Json?` contient aujourd'hui `{ healthBreakdown }` écrit
par `HealthAggregationService.recomputeSite()`. Le breakdown est un
tableau de composants — structure stable.

**Migration** :
- Nouvelle table `SiteHealthSnapshot` 1:1 avec Site
  (overall HealthStatus, linksUp Int, linksDown Int, assetsDown Int,
  sdwanState String?, computedAt DateTime).
- Détails granulaires (components[]) restent en JSON column
  `componentsJson Json?` sur cette même table — variabilité de structure
  acceptable.
- Adapter `recomputeSite()` pour écrire dans la table dédiée.
- Adapter le frontend (`liveHealthComponents` dans sites/[id]/page.tsx).
- `Site.metadata` reste pour `serverInfo` (smbPath, sharepointUrl, …) qui
  est aussi un blob mais hors scope (ADR-013 l'avait classé "low priority,
  rare access").

**Gain** : query "sites avec ≥1 asset DOWN dans les 24h" devient
trivial en SQL au lieu de scanner du JSON.

#### 4 (optionnel selon temps restant). `Site.contacts` → table `Contact`

`Site.contacts: Json?` array de `{name, phone, email, role, isPrimary}`.
La table `Contact` existe déjà avec FK siteId (`contactsOnSite`).

**Migration** :
- Pour chaque site, lire `Site.contacts`, créer les `Contact` rows
  manquants (idempotent par déduplication name+email), drop la colonne
  JSON.
- Adapter le frontend (Site detail "Contacts en grille de 3" lit
  `site.contacts` actuellement).

**Gain** : contacts queryables (recherche globale), réutilisables entre
sites, même cycle de vie que les autres contacts.

#### NON-cibles (gardés en JSON volontairement)

- `Site.accessNotes Json?` (`{schedules, badges, procedures, safety}`) —
  4 sous-objets stables, faible variabilité, jamais queryés. **OK en JSON**.
- `Site.emplacements Json?` `[{type,url,description}]` — list libre,
  pas de query métier dessus. **OK en JSON**.
- `Asset.adminLinks Json?` (à confirmer post-split networkInfo) — list
  libre. **OK en JSON**.
- `VendorCatalog.content Json` — payload uploadé brut, by-design opaque.
  **OK en JSON**.
- `MonitorHttpConfig.expectedBodyContains` — déjà un champ String? (pas
  un JSON), zéro action.

ADR-018 (ou prolongement ADR-013) à rédiger pour graver les choix
JSON conservés vs. extraits.

**Charge S6/S7** : 3-4h pour les 3 cibles principales (Asset.networkInfo,
Tenant.config split, Site.healthBreakdown). Le 4 (Site.contacts) si le
temps le permet, sinon en suivi.

---

## Tag v1.6.0 et clôture

À la fin de la session, après :
1. S5 livré (migrations Prisma versionnées, post-push.sql supprimé).
2. S6/S7 livrés (au moins 3 des 4 cibles JSON).
3. Smoke tests prod OK (reset+reseed+migrate+probes vertes).
4. Documentation à jour (README, INSTALL_DEV, ADR-017, ADR-018).

Poser le tag :
```
git tag -a v1.6.0 -m "v1.6.0 — Prisma migrations + JSON debt cleanup"
git push origin v1.6.0
```

Mettre à jour `package.json` (backend + frontend) à 1.6.0.
Mettre à jour `MEMORY.md` "Versioning" pour refléter v1.6.0.

---

## Reste secondaire (hors session, à glisser au fil de l'eau)

- **Tests monitoring complémentaires** (continu) : `http.probe.spec`,
  `icmp.probe.spec`, `monitor.processor.spec`, `health-aggregation.spec`,
  `monitor-reactions.spec`, `safe-lookup.spec`, `safe-http.spec`.
- **Sécurité — chip ouverte** : rotation du PAT GitHub trouvé en clair
  dans `/opt/xch-dev/XCH/.git/config` sur xch-deploy
  (cf. `mcp__ccd_session__spawn_task` du 2026-04-26). 30 min en autonome.
- **Pilote retours réels** : real-time site health, bannière
  auto-disable, auto-sync IP, UX produit nouvellement livrés à
  observer en usage chantier réel. Corriger ce qui sort.

---

## Workflow de session

1. **ADR-017** d'abord (S5 design). Validation utilisateur courte (15 min).
2. S5 implémentation par étapes : migration baseline → CHECK migrée →
   entrypoint → tests prod (reset complet + smoke).
3. **ADR-018** ensuite (S6/S7 design des 3-4 cibles). Validation
   utilisateur courte.
4. S6/S7 implémentation cible par cible, commits atomiques.
5. **Un seul rebuild backend + frontend à la fin**, suivi du reset+reseed
   + smoke complet.
6. Tag v1.6.0 + update version + push tag.
7. Rapport final + prompt suivant (UX/UI globale en session séparée).

## Contraintes

- Aucune dette technique — les drops doivent être propres.
- L'app reste production-ready au fil de l'eau (pas de feature flag
  ni migration partielle non terminée).
- En prod xch-deploy, reset complet autorisé (données démo).
- Cible utilisateurs : laptop / iPad / tablette.

## Avant de coder

1. Lire [ADR-013 (résiduel JSON)](../decisions/adr-013-residual-json-debt.md)
   pour comprendre les arbitrages JSON déjà actés.
2. Lire `MEMORY.md` (sources de vérité, deploy workflow, accès prod,
   versioning).
3. Lire `backend/prisma/post-push.sql` pour comprendre les CHECK à
   migrer en S5.
4. Confirmer que la base xch-deploy est en mode "données démo
   réinitialisables" (vrai par défaut, juste re-vérifier).

Réponds par "OK, je rédige ADR-017" et on démarre par S5.
