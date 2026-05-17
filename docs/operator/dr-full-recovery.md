# XCH — Guide infrastructure DR recovery par mode de déploiement

> **Date** : 2026-05-17 — Track E.4 PR3 (v2.4.0)
> **Public** : opérateurs RSI + IT client, DPO, équipe infogérance.
> **Statut** : **recommandations**. La mise en œuvre relève de la **responsabilité de l'IT client** selon le mode de déploiement et la politique de sauvegarde existante. XCH **ne fournit pas** d'outil DR infrastructure générique — les outils mentionnés (Veeam, Avamar, pg_dump, LVM, ZFS, snapshots cloud provider, etc.) sont des standards industrie utilisés par le client selon sa politique.

---

## §1 — Périmètre

### 1.1 Ce que couvre ce guide

Recovery infrastructure après perte d'infrastructure XCH :
- Volume Postgres détruit (corruption disque, suppression accidentelle)
- VM crashée, host filesystem perdu
- Site hosting défaillant (datacenter indisponible)
- Redéploiement de zéro sur nouvelle infrastructure
- Migration d'environnement (changement de cloud, changement d'hyperviseur)
- Validation de la chaîne complète bootstrap → restauration de tous les composants → smoke prod

### 1.2 Ce que ce guide N'EST PAS

Pour les scénarios suivants, **utiliser** [`dr-drill.md`](dr-drill.md) :
- Restore de contenu applicatif (suppression accidentelle de données dans un tenant)
- Test backup → restore au sein d'un tenant existant
- Validation de l'idempotence de `restore-full.sh`
- Validation des migrations (`delegationId`, `BACKUP_COMPLETED`)
- Recovery RTO ≤ 1 h pour content recovery same-tenant

### 1.3 Pourquoi cette séparation

Backup v2 XCH (cf [ADR-025](../decisions/adr-025-backup-v2-streaming.md)) est conçu pour le **content recovery applicatif same-tenant** : il exporte les données d'un tenant et permet de les ré-injecter dans un tenant existant. Il **n'exporte pas** les UserDelegation, les configurations d'infrastructure (`.env`, certificats, secrets compose), ni le volume Postgres complet (multi-tenant + system tables + Bull queues). Pour reconstruire une infrastructure XCH complète après perte, les outils standards d'infrastructure (snapshots, `pg_dump`, rsync chiffré) sont nécessaires et **sortent du périmètre fonctionnel XCH**.

---

## §2 — Composants à sauvegarder

Liste exhaustive des artefacts à inclure dans la stratégie de sauvegarde infrastructure :

### 2.1 Base de données Postgres

- **Database** : `xch_dev` (PAS `xch_db` — cf CLAUDE.md convention historique)
- **Localisation** : conteneur `xch-postgres`, volume Docker `backend_postgres_data` (ou équivalent selon Docker Compose project name)
- **Sauvegarde recommandée** : `pg_dump --format=custom --compress=9` (taille typique pour pilote ≤ 1 GB → ≈ 50-200 MB compressé)
- **Restauration** : `pg_restore --clean --if-exists --no-owner --no-acl`

### 2.2 Stockage objet MinIO

- **Bucket principal** : `xch-backups` (backups applicatifs v2 — ADR-025)
- **Bucket(s) uploads** : `xch-uploads` (si activé) — photos terrain, justificatifs dépenses, plans rendered
- **Localisation** : conteneur `xch-minio`, volume Docker `backend_minio_data`
- **Sauvegarde recommandée** : `mc mirror` vers stockage offsite, OU snapshot du volume Docker (cohérence transactionnelle non garantie si MinIO actif — préférer mirror)
- **Restauration** : `mc mirror` inverse, OU restore du volume + redémarrage

### 2.3 Configuration et secrets

- **`backend/.env`** : `DATABASE_URL`, `JWT_SECRET`, `XCH_MASTER_KEY` (chiffrement backups + secrets at-rest ADR-019), `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- **`/opt/xch-dev/XCH/.env`** (xch-deploy) ou racine repo (dev local) : `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `POSTGRES_PASSWORD`, ports, compose-level
- **`docker-compose.yml`** + `docker-compose.glitchtip.yml` + override files éventuels
- **`glitchtip/.env`** si GlitchTip self-hosted déployé
- **Certificats TLS** : `/etc/nginx-proxy-manager/data/` (NPM), OU `/etc/letsencrypt/` (certbot), OU certificats CA interne client

> **Note critique** : la **passphrase LUKS** des USB chiffrés offsite (cf [`offsite-backup.md`](offsite-backup.md)) doit être stockée séparément (vault opérateur, scellée envelope, Shamir secret sharing) — JAMAIS sur les médias eux-mêmes.

### 2.4 Stack Docker

- `docker-compose.yml` (versionné dans le repo Git)
- Variables d'environnement (cf 2.3)
- **Images Docker** : non requises en backup si registry accessible (cloud) OU `images/*.tar` pour air-gap (cf `scripts/package-release.sh`)

### 2.5 Monitoring et observabilité

- **GlitchTip** : volume `glitchtip_postgres_data` + `glitchtip_uploads` — recovery optionnelle (peut être recréé depuis zéro avec perte de l'historique events 90 jours)
- **Grafana** : dashboard JSON (versionner dans le repo client OU export régulier)
- **Audit log** : déjà inclus dans la DB Postgres (table `audit_log`, rétention 1 an, purge cron mensuelle)

---

## §3 — Recommandations par mode de déploiement

> Alignement avec [`deployment-modes.md`](deployment-modes.md) — matrice 4-mode officielle.

### 3.1 Mode A — Cloud public (OVH / AWS / Scaleway EU)

| Item | Recommandation |
|---|---|
| **Stratégie principale** | Snapshots automatisés VM provider (EBS / Cloud Volumes / Scaleway snapshots) |
| **Cadence** | **Quotidienne minimum** (snapshot consistent VM-level) |
| **Rétention** | 7-30 jours selon politique RGPD client (rotation lifecycle policy) |
| **Localisation snapshots** | Hébergeur, région UE strict (vérifier pas de réplication implicite hors UE) |
| **Restauration RTO** | 1-4 h (création nouvelle VM depuis snapshot + reconfigure DNS) |
| **Offsite cross-region** | Optionnel, recommandé pour DR géo (S3 cross-region replication UE-only, ou snapshot copy vers autre datacenter UE) |
| **Outils standards** | AWS Backup / Azure Backup / GCP Cloud Backup, OVH Auto-Backup, Scaleway Backup |
| **Coût mensuel typique** | 5-50 €/mois selon volume |

### 3.2 Mode B — Cloud privé client (datacenter client)

| Item | Recommandation |
|---|---|
| **Stratégie principale** | **Intégrer aux backups infrastructure existants du client** (Veeam, Avamar, Commvault, NetBackup, Bareos selon l'écosystème IT client) |
| **Chemins à inclure dans la job de backup** | Volumes Docker `backend_postgres_data`, `backend_minio_data`, `backend_redis_data` ; fichiers `.env` ; certificats TLS ; configuration Docker Compose |
| **Cadence** | **Quotidienne** alignée sur la politique client générale |
| **Rétention** | Selon politique client (typique : 7 jours rolling + 4 semaines + 12 mois) |
| **Localisation** | NFS share interne client, OU storage object client interne, OU bandes selon politique |
| **Restauration RTO** | 2-8 h (procédure documentée par l'infogérant client) |
| **Coordination** | Convention de service entre RSI et infogérant client doit lister précisément les chemins XCH et le test de restauration trimestriel |

### 3.3 Mode D — VPS basique (Hetzner / OVH dédié)

| Item | Recommandation |
|---|---|
| **Option A — snapshot VM hébergeur (si proposé)** | Hetzner Cloud / OVH VPS Backup — cadence quotidienne, rétention 7-14 jours, restauration via console |
| **Option B — pg_dump + rsync vers stockage offsite** | Cron quotidien : `pg_dump --format=custom xch_dev` + `mc mirror` MinIO + tar `.env` → chiffrer (AES-256, ex: `openssl enc` ou `age`) → rsync vers VPS secondaire UE OU stockage object S3-compatible UE |
| **Cadence** | Quotidienne |
| **Rétention** | 7-14 jours pour drives nearline, archives mensuelles si politique RGPD client le requiert |
| **Restauration RTO** | 2-6 h |
| **Coût mensuel typique** | 5-15 €/mois pour stockage offsite (Hetzner Storage Box / OVH Cloud Archive) |

### 3.4 Mode C — Air-gap strict (pilote employeur référence)

| Item | Recommandation |
|---|---|
| **Stratégie principale** | Snapshot du volume LVM ou ZFS de la VM hôte, **OU** `pg_dump` régulier vers USB chiffré LUKS (référencer [`offsite-backup.md`](offsite-backup.md)) |
| **Option A — Snapshots LVM/ZFS** | Snapshot consistent du volume host (`lvm snapshot` ou `zfs snapshot`), export `.img` vers USB chiffré LUKS rotation hebdo |
| **Option B — pg_dump + rsync** | `pg_dump --format=custom xch_dev` + tar des volumes Docker MinIO → chiffrement (déjà LUKS sur USB) → rotation USB hebdo selon procédure existante |
| **Cadence** | **À définir avec DPO** selon criticité — typique : pg_dump quotidien interne + rotation USB hebdo |
| **Rétention USB** | 2 clés USB en rotation (impair / pair), conservation géographique séparée |
| **Restauration RTO** | 4-24 h (procédure manuelle, transit USB inclus) |
| **Outils** | `cryptsetup`, `pg_dump`, `rsync`, `tar` (tous présents par défaut Ubuntu Server) |

> **Renvoi** : pour la procédure détaillée de rotation USB LUKS hebdo, voir [`offsite-backup.md`](offsite-backup.md). Ce guide §3.4 décrit le **scope d'usage** ; `offsite-backup.md` décrit le **comment**.

---

## §4 — Procédure de restauration générique

> Étapes communes à tous les modes ; les outils spécifiques varient (cf §3).

### 4.1 Préparation infrastructure cible

1. **Provisionner l'environnement cible** :
   - VM ou serveur conforme aux pré-requis (8 vCPU / 32 GB / 500 GB SSD min — cf `deployment-modes.md` §3)
   - OS de base (Ubuntu Server 22.04 LTS recommandé)
   - Docker + Docker Compose installés
2. **Préparer le réseau** : DNS interne / public configuré selon mode, certificats préparés ou Let's Encrypt si DNS public, UFW initial (cf [`server-hardening.md`](server-hardening.md))

### 4.2 Redéploiement stack vierge

1. **Cloner le repo** XCH (Git remote OU tarball offline) :
   ```bash
   git clone https://github.com/eoncom/XCH /opt/xch-dev/XCH
   cd /opt/xch-dev/XCH
   git checkout v2.4.0  # ou tag souhaité
   ```
2. **Bootstrap stack vierge** : suivre [`bootstrap-runbook.md`](bootstrap-runbook.md) (Mode C air-gap) OU [`cutover-prod-airgap.md`](cutover-prod-airgap.md) (cutover air-gap), OU les templates `cutover-templates/` pour Modes A/B/D
3. **Vérifier que les containers infra sont up healthy** AVANT restauration

### 4.3 Restauration des composants

1. **Restaurer les `.env`** (les deux fichiers — cf `dr-drill.md` §10.2.cinq finding F10) :
   ```bash
   cp <backup>/backend.env backend/.env
   cp <backup>/root.env .env
   ```
2. **Restaurer Postgres** :
   ```bash
   docker compose -f backend/docker-compose.yml up -d postgres
   # Attendre healthy
   docker exec -i xch-postgres psql -U xch_user -d postgres <<'SQL'
     DROP DATABASE IF EXISTS xch_dev;
     CREATE DATABASE xch_dev OWNER xch_user;
   SQL
   docker exec -i xch-postgres pg_restore -U xch_user -d xch_dev --clean --if-exists --no-owner --no-acl < /path/to/xch_dev.dump
   ```
3. **Restaurer MinIO bucket** :
   ```bash
   docker compose -f backend/docker-compose.yml up -d minio minio-init
   # Configurer mc alias local → MinIO container
   docker exec xch-minio mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
   # Mirror depuis offsite
   docker exec xch-minio mc mirror /offsite-backup/xch-backups/ local/xch-backups/
   ```
4. **Restaurer certificats TLS** : copier dans le path attendu par NPM ou nginx (selon configuration client)
5. **Restaurer GlitchTip** (optionnel — recovery historique events) : restore volumes `glitchtip_postgres_data` + `glitchtip_uploads`

### 4.4 Démarrage applicatif + vérification

1. **Démarrer la stack complète** :
   ```bash
   docker compose -f backend/docker-compose.yml up -d
   docker compose ps  # → tous healthy
   ```
2. **Vérifier les migrations Prisma rejouées** :
   ```bash
   docker exec xch-backend npx prisma migrate status
   # → "Database schema is up to date!"
   ```
3. **Smoke 6/6** :
   ```bash
   bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
   # → 6/6 PASS attendu
   ```
4. **Test login utilisateur réel** : se connecter avec un compte du tenant principal, vérifier que les données métier sont présentes (sites, assets, audit log historique).

### 4.5 Rollback en cas d'échec

Si la restauration échoue à mi-chemin (corruption pg_dump, MinIO mirror incomplet, etc.) :
- Conserver les artefacts d'erreur pour forensic
- Repartir d'une infrastructure cible vierge (étape 4.1)
- Utiliser une sauvegarde plus ancienne si disponible
- Escalader selon [`incident-response.md`](incident-response.md)

---

## §5 — Drill DR infrastructure

### 5.1 Cadence recommandée

| Criticité métier | Cadence drill infrastructure |
|---|---|
| Très haute (SLA 99.9 % + production critique) | **Trimestrielle** |
| Haute (production standard) | **Semestrielle** |
| Modérée (interne / non-critique) | **Annuelle** |

> Cadence à figer dans la convention de service entre RSI et client (cf [`handoff.md`](handoff.md) Section 4.2).

### 5.2 Procédure de validation

1. **Provisionner un environnement bac-à-sable** (VM jetable, NE PAS toucher la prod)
2. **Exécuter §4 procédure de restauration générique** depuis le dernier backup infrastructure
3. **Mesurer le temps total** (RTO réel) : provisioning + restoration + smoke
4. **Comparer aux SLA contractuels** :
   - Si RTO mesuré ≤ SLA → drill PASS
   - Si RTO mesuré > SLA → réviser la procédure / l'infrastructure (snapshot incremental, parallélisation des étapes, etc.)
5. **Documenter le drill** dans `docs/operator/drill-reports/YYYY-MM-DD-infrastructure.md`

### 5.3 RTO/RPO cibles indicatives

| Mode | RTO infrastructure cible | RPO infrastructure cible |
|---|---|---|
| Mode A — cloud public | 1-4 h | 24 h |
| Mode B — cloud privé | 2-8 h | 24 h |
| Mode C — air-gap | 4-24 h | 24 h (pg_dump quotidien) à 7 j (USB hebdo seul) |
| Mode D — VPS basique | 2-6 h | 24 h |

> Ces valeurs sont **indicatives** — les SLA réels sont à négocier avec le client selon sa tolérance au downtime.

---

## §6 — Disclaimer

Ce guide fournit des **recommandations**. La mise en œuvre opérationnelle (choix des outils, configuration des cron jobs, intégration aux solutions client existantes, exécution des drills) relève de la **responsabilité de l'IT du client** selon sa politique de sauvegarde, sa criticité métier, et son budget infrastructure.

Les outils mentionnés (Veeam, Avamar, Commvault, NetBackup, Bareos, `pg_dump`, LVM, ZFS, snapshots cloud provider, `cryptsetup`, `rsync`, `mc mirror`, `openssl`, `age`, etc.) sont des **standards industrie largement utilisés**. XCH **ne fournit pas** d'outil DR infrastructure générique et ne maintient pas de wrapper autour de ces outils.

En cas de doute sur le choix de stratégie pour un mode donné, ou pour validation de la procédure de restauration avant le premier drill réel, contacter le lead technique RSI ou le DPO du client.

---

## Cross-références

- [`dr-drill.md`](dr-drill.md) — drill restore **applicatif** (content recovery same-tenant, RTO ≤ 1 h)
- [`bootstrap-runbook.md`](bootstrap-runbook.md) — bootstrap stack vierge (utilisée en §4.2)
- [`cutover-prod-airgap.md`](cutover-prod-airgap.md) — cutover Mode C pilote employeur
- [`cutover-templates/`](cutover-templates/) — templates dry-run Modes A/B/D
- [`offsite-backup.md`](offsite-backup.md) — rotation USB chiffrés LUKS (Mode C)
- [`deployment-modes.md`](deployment-modes.md) — matrice 4-mode officielle
- [`rgpd-multi-mode.md`](rgpd-multi-mode.md) — conformité RGPD par mode (responsabilités backup)
- [`handoff.md`](handoff.md) §4 — checklist drill applicatif + infrastructure
- [`recovery-runbook.md`](recovery-runbook.md) — scénarios service-down (Postgres / Redis / MinIO / Backend) — recovery composant individuel sans perte d'infrastructure
- [`incident-response.md`](incident-response.md) — escalade et procédure post-mortem
- [`server-hardening.md`](server-hardening.md) — UFW + SSH + fail2ban initial
- [ADR-025](../decisions/adr-025-backup-v2-streaming.md) — design backup v2 streaming + idempotent restore

---

**Note de fin** : Ce guide est livré v2.4.0 (Track E.4 PR3). Il sera révisé après le premier drill infrastructure réel post-cutover pilote (Track D.3.4 — cf MCP `XCH_PLAN_V3_POST_V2_2026_05_17`).
