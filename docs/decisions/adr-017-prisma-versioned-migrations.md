# ADR-017 : Migrations Prisma versionnées (`migrate deploy`) — fin de `db push`

**Date :** 2026-04-27
**Statut :** **Proposé** — en attente de validation utilisateur avant implémentation S5
**Référence :** [ADR-013](adr-013-residual-json-debt.md), [ADR-014](adr-014-native-monitoring.md), [ADR-016](adr-016-monitoring-unification.md)
**Impacte :** [ADR-018](adr-018-json-debt-cleanup.md) (à venir — S6/S7) qui doit s'appuyer sur ce socle

---

## Contexte

Depuis l'origine du projet, le déploiement utilise `prisma db push --accept-data-loss` dans `backend/docker-entrypoint.sh:17` pour synchroniser le schéma. Conséquences observées :

1. **Aucune historisation versionnée** des changements de schéma → impossible de rollback proprement, impossible de rejouer la même séquence de migrations sur deux environnements et garantir un état identique.
2. **Les CHECK constraints natives PostgreSQL** vivent dans `backend/prisma/post-push.sql` (3 contraintes ADR-014 sur `monitor_checks` : `target_exclusive`, `tcp_port_required`, `interval_bounds`), exécutées en idempotent à chaque boot via un script séparé. Elles ne sont pas tracées dans le `schema.prisma` versionné, et leur état réel sur une base donnée dépend du dernier boot réussi.
3. **Les drops de colonnes effectués dans les ADR successifs** (ADR-013 SD-WAN, ADR-016 lot E `ConnectivityLink.{monitorName,status}` + `SdwanConfig.{monitorName,status}`) tournent en silence via `db push --accept-data-loss`. La trace de ces drops n'existe que dans les commits, pas dans une séquence versionnée rejouable.
4. **L'extension PostGIS** est déclarée via `previewFeatures = ["postgresqlExtensions"]` + `extensions = [postgis]` dans `schema.prisma`, et Prisma la gère via `db push`. En `migrate dev/deploy`, le support des extensions est plus limité — il faut une migration manuelle qui fait `CREATE EXTENSION IF NOT EXISTS postgis` AVANT la création des colonnes `geometry`.
5. **Les sessions S6/S7 (ADR-018) vont dropper / renommer/extraire des colonnes JSON** (`Asset.networkInfo`, `Tenant.config`, `Site.healthBreakdown`, possiblement `Site.contacts`). Faire ces refactos sans infra de migrations versionnées les rend non-revertibles et non-traçables — incompatible avec le principe directeur XCH (« pas de dette technique, règles de l'art »).
6. **L'orchestrateur de déploiement anticipe déjà S5** : `scripts/check-deploy-parity.sh` (check #6, lignes 163-174) attend la présence du dossier `backend/prisma/migrations/` pour basculer en `OK`. `scripts/deploy-auto.sh` (lignes 123-143) propose encore un menu à 4 options dont `db push` (option 1) qui n'aura plus de sens une fois cet ADR appliqué. Le nettoyage de ces scripts fait partie du livrable S5.

   *Note : `docs/installation/INSTALL_DEV.md` et `docs/installation/INSTALL_PROD.md` sont obsolètes (confirmé par le lead 2026-04-27) — la source de vérité install/deploy est `scripts/`. Aucune mise à jour de ces docs n'est planifiée par cet ADR.*

Le plan v2 a explicitement réservé S5 à ce changement. Il doit tourner **avant** S6/S7 pour que les drops/renames JSON soient propres.

---

## Décision

Bascule complète du projet de `prisma db push --accept-data-loss` vers `prisma migrate deploy` (prod) + `prisma migrate dev` (dev), avec une migration **baseline `0_init`** capturant l'état schéma actuel et une migration **`1_post_push_constraints`** intégrant les 3 CHECK et l'extension PostGIS.

Cinq sous-décisions structurantes (A → E).

---

## Décision A — Migration baseline `0_init` capturant le schéma courant

### Stratégie

`prisma migrate dev --create-only --name init` génère le SQL de la migration baseline depuis le `schema.prisma` actuel sur une base vide. Le fichier `prisma/migrations/<timestamp>_init/migration.sql` est commité tel quel — il devient la source canonique de l'état initial.

**Procédure exacte** (exécutée localement par le lead, une seule fois) :
1. Lancer un Postgres tout neuf (conteneur jetable).
2. `npx prisma migrate dev --name init --create-only` génère `migration.sql` SANS appliquer (la base reste vide).
3. Inspection visuelle du SQL généré pour vérifier que l'ordre des CREATE TABLE / FK / index est cohérent.
4. Commit du dossier `prisma/migrations/0_init/` (le timestamp est remplacé par `0_init` pour ordering explicite — convention `<n>_<name>`).
5. Test : `prisma migrate deploy` sur une base vide doit reproduire l'état schéma actuel.

### Pourquoi `--create-only` plutôt qu'un `migrate dev` qui applique

L'application immédiate sur la dev DB locale du lead **détruirait les données démo locales** sans backup. Le `--create-only` permet de générer le SQL en amont, le valider, le commiter, puis appliquer dans un second temps via un reset contrôlé.

### Cas particulier — extension PostGIS

`prisma migrate` ne gère pas nativement les extensions PostgreSQL (le support `previewFeatures = ["postgresqlExtensions"]` côté `db push` ne se transpose pas automatiquement en migrations). La baseline doit donc commencer par une instruction manuelle :

```sql
-- 0_init/migration.sql (en tête de fichier, AVANT toute CREATE TABLE)
CREATE EXTENSION IF NOT EXISTS postgis;
```

Insertion **manuelle après génération** par `--create-only` (Prisma ne l'écrira pas seul). Le `IF NOT EXISTS` rend l'opération idempotente et compatible avec une base où PostGIS serait pré-installé par l'image Docker.

L'ordre est critique : la table `sites` contient `coordinates Unsupported("geometry(Point,4326)")` (ligne 268 du schéma) — la colonne ne peut être créée que si l'extension est présente.

---

## Décision B — Migration `1_post_push_constraints` pour les CHECK ADR-014

### Contenu

Les 3 CHECK actuels de `backend/prisma/post-push.sql` sont déplacés dans une migration versionnée dédiée :

```sql
-- prisma/migrations/1_post_push_constraints/migration.sql

ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_target_exclusive"
  CHECK (num_nonnulls("siteId", "assetId", "linkId") = 1);

ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_tcp_port_required"
  CHECK (
    (kind = 'TCP'  AND "targetPort" IS NOT NULL) OR
    (kind <> 'TCP' AND "targetPort" IS NULL)
  );

ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_interval_bounds"
  CHECK ("intervalSec" >= 60 AND "intervalSec" <= 3600);
```

Pas de `DROP CONSTRAINT IF EXISTS` ici : dans le modèle versionné, la contrainte n'a jamais existé sur la base avant cette migration. L'idempotence du script `post-push.sql` (qui utilisait DROP IF EXISTS + ADD) n'est plus nécessaire.

### Suppression de `post-push.sql`

Une fois `1_post_push_constraints` en place et déployée :
- `backend/prisma/post-push.sql` est **supprimé**.
- `backend/docker-entrypoint.sh:21-23` (le `prisma db execute --file ./prisma/post-push.sql`) est **retiré**.
- `backend/package.json` script `db:sync` (qui chaînait `db push` + `db execute post-push.sql`) est **supprimé**.

Toute défense en profondeur réside désormais dans le schéma versionné, à un seul endroit.

### Pourquoi pas dans `0_init`

Garder les CHECK isolés dans une migration séparée :
- Documente leur origine ADR-014 (lecture du `migration.sql` = lecture de la décision).
- Permet de les rejouer/rollback indépendamment du baseline (ex. si on voulait expérimenter sans la borne 60s sur `intervalSec`).
- Évite de toucher `0_init/migration.sql` à chaque modification d'une CHECK existante.

---

## Décision C — Entrypoint Docker bascule sur `migrate deploy`

### Modification

`backend/docker-entrypoint.sh` :

```diff
 if [ "$XCH_MODE" = "worker" ]; then
   echo "🛠️  XCH_MODE=worker — skipping prisma migrations (handled by API)"
   echo "🚀 Starting XCH Backend Worker (no HTTP)..."
   exec node dist/main --worker
 fi

 echo "🔄 Generating Prisma client..."
 npx prisma generate

-echo "🔄 Applying database schema..."
-npx prisma db push --accept-data-loss
-
-echo "🔒 Applying post-push SQL constraints..."
-npx prisma db execute --file ./prisma/post-push.sql --schema ./prisma/schema.prisma || \
-  echo "⚠️  post-push.sql failed (table may not exist yet on a fresh install — will retry next boot)"
+echo "🔄 Applying versioned migrations..."
+npx prisma migrate deploy

 if [ "$AUTO_SEED" = "true" ]; then
   echo "🌱 Seeding database..."
   npx prisma db seed || echo "⚠️ Seed skipped (may already exist)"
 fi
```

Le worker continue de skipper les migrations (race-free, ADR-014). `prisma migrate deploy` prend un advisory lock Postgres lui-même, donc même si deux conteneurs API démarrent en parallèle (improbable en single-node), l'un attend l'autre proprement.

### Comportement sur erreur

`prisma migrate deploy` échoue (exit non-zéro) si :
- Une migration `failed` est marquée dans `_prisma_migrations` (rollback partiel précédent).
- Le schéma de la base diverge de la dernière migration appliquée (drift détecté).
- Une migration nouvelle ne peut pas s'appliquer (CHECK violée par les données existantes, FK manquante, etc.).

L'API ne démarre pas → `docker-compose up` bloque visiblement → l'opérateur intervient. **C'est le comportement souhaité** : pas de boot silencieux sur état schéma incohérent. C'est une amélioration nette par rapport à `db push --accept-data-loss` qui « répare » silencieusement en perdant des données.

---

## Décision D — Stratégie de bascule sur xch-deploy : reset complet

### Choix : reset, pas baseline as-applied

Deux options techniques pour amorcer une base existante en mode `migrate` :

| Option | Description | Choix |
|---|---|---|
| **A. Reset complet** | `prisma migrate reset` (drop schéma) → `migrate deploy` → `db seed` | **✅ Retenu** |
| **B. Baseline as-applied** | `prisma migrate resolve --applied 0_init` puis `--applied 1_post_push_constraints`, sans toucher aux données | Rejeté |

**Pourquoi A (reset)** :
- xch-deploy contient des **données démo seedées**, pas de la donnée pilote critique. La règle projet « données courantes = démo, réinitialisables » s'applique.
- Le seed est idempotent et reseede tout en ~30 secondes.
- Zéro risque de drift schéma : la base post-reset est exactement l'image des migrations versionnées, point.
- Procédure simple et reproductible. Si demain un opérateur reproduit l'environnement, la même séquence reset+deploy+seed donne la même base.

**Pourquoi pas B (resolve --applied)** :
- Suppose que le schéma actuel xch-deploy correspond *exactement* à `0_init` + `1_post_push_constraints`. Tout drift silencieux passé (ex. une CHECK qui aurait été drop manuellement, une colonne renommée hors `schema.prisma`) ne serait pas détecté.
- Plus complexe, plus fragile, gain nul pour le projet (les données ne sont pas précieuses).

### Procédure prod xch-deploy

1. SSH `xch-deploy:/opt/xch-dev/XCH`.
2. `git pull` la version qui contient les migrations + l'entrypoint modifié.
3. **Backup snapshot** de la base (dump pg_dump rapide, juste pour rollback de panique — sera jeté).
4. `docker-compose down`.
5. `docker-compose run --rm backend npx prisma migrate reset --force --skip-seed`.
6. `docker-compose up -d` → l'entrypoint applique `migrate deploy` sur base vide → schéma propre.
7. `docker exec xch-backend npx prisma db seed` → réinjecte le seed démo.
8. Smoke tests (probes vertes, login `@demo.fr` / `Demo1234`, création asset, dashboard monitoring rendu).

`scripts/deploy-auto.sh` est ajusté en parallèle pour refléter ce flow (cf. Décision E).

### Procédure dev locale

Identique : `npx prisma migrate reset --force` puis `npx prisma db seed`. Reset autorisé en dev par construction.

---

## Décision E — Workflow dev pour créer de nouvelles migrations

### Commandes canoniques

`backend/package.json` scripts mis à jour :

```diff
   "prisma:generate": "prisma generate",
-  "prisma:migrate": "prisma migrate dev",
-  "prisma:migrate:deploy": "prisma migrate deploy",
+  "db:migrate:dev": "prisma migrate dev",
+  "db:migrate:deploy": "prisma migrate deploy",
+  "db:migrate:reset": "prisma migrate reset",
   "prisma:studio": "prisma studio",
-  "db:push": "prisma db push --accept-data-loss",
-  "db:sync": "prisma db push --accept-data-loss && prisma db execute --file ./prisma/post-push.sql --schema ./prisma/schema.prisma"
```

`db:push` et `db:sync` sont **supprimés**. Tout passe par `migrate`.

### Workflow standard

Pour modifier le schéma :
1. Éditer `backend/prisma/schema.prisma`.
2. `npm run db:migrate:dev -- --name <description-courte>` — génère un nouveau dossier `prisma/migrations/<timestamp>_<description>/`, applique sur la dev DB, régénère le client Prisma.
3. Vérifier le `migration.sql` généré (corrections manuelles possibles si Prisma génère un SQL non optimal — ex. extension, CHECK, ordre de drops).
4. Commit du dossier de migration.
5. En prod : `migrate deploy` rejoue automatiquement au boot.

### Pour les drops/renames complexes (S6/S7 ADR-018)

Quand un refacto touche des données (rename de colonne, split d'une colonne JSON en colonnes scalaires) :
1. `prisma migrate dev --create-only` pour générer le squelette.
2. **Édition manuelle** du `migration.sql` pour ajouter les `UPDATE` de migration de données entre la création des nouvelles colonnes et le DROP des anciennes.
3. Appliquer via `prisma migrate dev` (sans `--create-only`).
4. Tester reset+deploy+seed pour confirmer l'idempotence sur base vierge.

### Procédure de rollback

`prisma migrate` ne fait pas de rollback automatique. La procédure XCH :
1. **Toujours forward-only** : un bug dans une migration → nouvelle migration corrective.
2. Si une migration vient de tomber en erreur sur `migrate deploy` (status `failed` dans `_prisma_migrations`) :
   - Identifier ce qui a foiré (logs Postgres, état de la table).
   - Corriger manuellement la base si nécessaire (`prisma db execute --file <fix.sql>` ou `psql`).
   - `prisma migrate resolve --applied <migration_name>` pour marquer la migration comme appliquée si elle a finalement abouti à un état correct.
   - **OU** `prisma migrate resolve --rolled-back <migration_name>` si l'état a été restauré au pré-migration et qu'on veut la retenter après correction.
3. Sur xch-deploy démo : reset+seed reste l'échappatoire ultime, autorisé.

### Mise à jour de `scripts/deploy-auto.sh`

Le menu interactif step 4 (lignes 123-143 actuelles) est simplifié pour refléter la fin de `db push` :

```diff
 echo "   Options de synchronisation:"
-echo "   1) db push (rapide, dev)"
-echo "   2) migrate deploy (production, safe)"
-echo "   3) reset + seed (complet, DESTRUCTIF)"
-echo "   4) skip (garder DB actuelle)"
+echo "   1) migrate deploy (standard — applique les migrations versionnées)"
+echo "   2) reset + seed (DESTRUCTIF — reset complet + seed démo)"
+echo "   3) skip (garder DB actuelle)"

 case $DB_CHOICE in
-    1) DB_ACTION="push" ;;
-    2) DB_ACTION="migrate" ;;
-    3) DB_ACTION="reset" ;;
-    4) DB_ACTION="skip" ;;
+    1) DB_ACTION="migrate" ;;
+    2) DB_ACTION="reset" ;;
+    3) DB_ACTION="skip" ;;
     *) DB_ACTION="skip" ;;
 esac

 case $DB_ACTION in
-    "push")
-        echo "   Exécution: prisma db push..."
-        npx prisma db push --accept-data-loss
-        ;;
     "migrate") ... # inchangé
     "reset")  ... # inchangé
     "skip")   ... # inchangé
 esac
```

`AUTO_DEPLOY_DB_ACTION=push` (variable d'env auto-mode) doit aussi être déprécié — si rencontrée, fallback sur `migrate` avec warning explicite.

### Mise à jour de `scripts/check-deploy-parity.sh`

Le check #6 (lignes 163-174) anticipe déjà la bascule. Aucune modification de logique requise — le check passera automatiquement en `OK` une fois `0_init` commité dans `backend/prisma/migrations/`. À nettoyer en fin de S5 : retirer la mention « (S5 pas encore exécutée — db push --accept-data-loss en place) » du message d'erreur fallback (ligne 173) puisque la condition ne sera plus jamais vraie.

---

## Conséquences

**Positives :**
- Historisation des changements de schéma (chaque migration = un commit lisible).
- Rejouabilité totale : reset+deploy+seed produit une base bit-identique sur n'importe quel environnement.
- CHECK constraints traçables dans `git log` au lieu d'un script séparé idempotent.
- S6/S7 (ADR-018) peut s'appuyer sur des migrations propres pour drop/rename des colonnes JSON.
- Comportement de boot strict : un drift schéma fait échouer le démarrage, plus de réparation silencieuse destructive.
- `scripts/check-deploy-parity.sh` (check #6 déjà câblé en mode "post-S5") devient automatiquement vert.

**Négatives (acceptées) :**
- Première bascule prod xch-deploy nécessite un reset+reseed (~5 min downtime). Acceptable, données démo.
- Workflow dev plus contraint : impossible de bricoler un changement de schéma sans le matérialiser en migration commitée. C'est exactement l'effet recherché.
- Les drops de colonnes en dev locale via `db push --accept-data-loss` n'existent plus — il faut faire `migrate dev` ou `migrate reset`. Coût opérationnel mineur, gain documentaire majeur.
- Extension PostGIS gérée à la main dans `0_init` (Prisma ne l'écrit pas). Documenté.

---

## Alternatives considérées

1. **Garder `db push` + post-push.sql** — rejeté. Bloquant pour S6/S7 (drops de colonnes JSON sans trace versionnée), viole le principe directeur XCH (« pas de dette »).
2. **`migrate diff` + scripts SQL custom au lieu de `migrate dev/deploy`** — rejeté. Réinvente l'outil, perte du tooling Prisma standard, complexité accrue sans gain.
3. **Baseline as-applied (option D.B)** au lieu de reset prod — rejeté (cf. Décision D : drift silencieux possible, gain nul vu les données démo).
4. **Garder `post-push.sql` en parallèle des migrations** pour les CHECK uniquement — rejeté. Deux mécanismes pour un seul besoin = dette par construction.
5. **Différer S5 et faire S6/S7 d'abord** — rejeté. Les drops de colonnes JSON tournent alors en `db push --accept-data-loss`, intraçables, irréversibles. Inverse du but recherché.

---

## Suivi

Tâches d'implémentation (ordre imposé) :

1. Backup local du `schema.prisma` actuel (référence pour vérifier la baseline générée).
2. Génération de `0_init/migration.sql` via `--create-only` sur Postgres jetable.
3. Insertion manuelle de `CREATE EXTENSION IF NOT EXISTS postgis;` en tête.
4. Création de `1_post_push_constraints/migration.sql` (copie des 3 CHECK).
5. Suppression de `backend/prisma/post-push.sql`.
6. Modification `backend/docker-entrypoint.sh` (retrait `db push` + `db execute`, ajout `migrate deploy`).
7. Mise à jour `backend/package.json` (scripts `db:migrate:*`, retrait `db:push` / `db:sync`).
8. Mise à jour `scripts/deploy-auto.sh` (retrait option `db push`, fallback `AUTO_DEPLOY_DB_ACTION=push` → `migrate`).
9. Nettoyage `scripts/check-deploy-parity.sh` (message fallback ligne 173 du check #6 simplifié).
10. Test reset complet local : reset → deploy → seed → smoke (login, monitoring, sites).
11. Push xch-deploy : reset+deploy+seed + smoke complet (probes, dashboard, login).
12. Commit atomique S5.

Pas d'impact sur les autres modules (pas de code applicatif touché). Toute la surface est `backend/prisma/`, `backend/docker-entrypoint.sh`, `backend/package.json`, et 2 scripts d'orchestration (`scripts/deploy-auto.sh`, `scripts/check-deploy-parity.sh`).

---

## Références

- [ADR-014](adr-014-native-monitoring.md) — origine des 3 CHECK migrées en `1_post_push_constraints`.
- [ADR-016](adr-016-monitoring-unification.md) — drops de colonnes monitoring effectués en `db push`, dont la trace ne sera plus possible sans migrations versionnées.
- [ADR-018](adr-018-json-debt-cleanup.md) (à venir) — refacto JSON résiduel, dépend de l'infra livrée par cet ADR.
- Plan v2 session S5 (mémoire `project_plan_v2.md`).
- Principe directeur XCH 2026-04-20 : « Toujours faire propre, pas de dette technique ».
