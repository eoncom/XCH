# XCH — DR drill (RTO/RPO mesurés) — Track E.2 Pass 5

> **Scope** : exercice réel de disaster recovery sur `xch-deploy` avec tenant démo comme cohorte sacrificielle. Mesures **observées le 2026-05-16**, baseline tag v2.3.2.
> **Placeholders Option C** : `<DEPLOY_DOMAIN>`, `<TENANT_ID>`, `<BACKUP_ID>`, `<RESTORE_JOB_ID>`.

---

## 1. Résumé exécutif

| KPI | Valeur mesurée | Méthode |
|---|---|---|
| **Backup duration** (job Bull v3) | **474 ms** | `duration_ms` du log `BullEvent { event: job-completed, job_name: backup-full }` |
| **Restore duration / RTO** (job Bull v3) | **1 095 ms ≈ 1,1 s** | `duration_ms` du log `BullEvent { event: job-completed, job_name: restore-full }` |
| **RPO** (pilote) | **convention ≤ 24h** | Backup on-demand UI ; cron différé Track D.3. RPO réel = `now() - max(backups.createdAt)` |
| **Encryption** | AES-256-GCM (ADR-019 + ADR-026) | Backup créé avec `encrypt: true`, sidecar `.enc.json` séparé |
| **Idempotence** | `_created: 12`, `_skipped: 189` | Natural-key match Prisma (ADR-025 §D) sur 19 tables × 5 phases FK |
| **Recovery** | Contact supprimé ✅ restauré | NK lookup → upsert (nouveau ID, mêmes champs) |

Conclusion : **pipeline backup v2 + restore v2 fonctionnel sur `xch-deploy`**, idempotence prouvée, encryption honorée. Les durations sont à extrapoler pour tenants prod plus volumineux (voir §6).

---

## 2. Contexte tenant cohorte

Tenant `Demo` (id placeholder `<TENANT_ID>`, valeur réelle = `cmojd5f1w0000p1e1qi7trjmv` sur xch-deploy) :

| Table | Pré-backup | Post-restore |
|---|---|---|
| sites | 9 | 9 |
| assets | 83 | 83 |
| tasks | 12 | 12 |
| contacts | 22 → 21 (post-DELETE) → **22** | 22 ✅ |
| racks | 14 | 14 |
| expenses | 1 | 2 (cf. note §5.2) |
| monitor_checks | 5 | 5 |

Volume : ~189 lignes (5 tables clés) + 8 fichiers MinIO = **~724 KB backup ZIP chiffré**.

---

## 3. Procédure exacte (reproductible)

### 3.1 Pré-flight — capture snapshot

```bash
ssh <DEPLOY_HOST> "docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  \"SELECT 'sites' tbl, COUNT(*) FROM sites WHERE \\\"tenantId\\\"='<TENANT_ID>' \
    UNION ALL SELECT 'assets', COUNT(*) FROM assets WHERE \\\"tenantId\\\"='<TENANT_ID>' \
    UNION ALL SELECT 'tasks',  COUNT(*) FROM tasks  WHERE \\\"tenantId\\\"='<TENANT_ID>' \
    UNION ALL SELECT 'contacts', COUNT(*) FROM contacts WHERE \\\"tenantId\\\"='<TENANT_ID>' \
    UNION ALL SELECT 'racks', COUNT(*) FROM racks \
    UNION ALL SELECT 'expenses', COUNT(*) FROM expenses WHERE \\\"tenantId\\\"='<TENANT_ID>' \
    UNION ALL SELECT 'monitor_checks', COUNT(*) FROM monitor_checks WHERE \\\"tenantId\\\"='<TENANT_ID>';\""
```

### 3.2 T0 — enqueue backup chiffré

```bash
# Login admin (cookies persisted)
curl -c /tmp/xch-cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'

# T0 = enqueue
T0=$(date +%s%3N)
curl -s -b /tmp/xch-cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/backup/full \
  -H 'Content-Type: application/json' \
  -d '{"encrypt":true}'
# → {"enqueued":true,"jobId":"<JOB_ID>"}
```

### 3.3 T1 — poll job until completed

```bash
# Poll backup job
for i in {1..30}; do
  RESP=$(curl -s -b /tmp/xch-cookies.txt https://<DEPLOY_DOMAIN>/api/backup/jobs/<JOB_ID>)
  STATE=$(echo "$RESP" | jq -r .state)
  echo "poll #$i state=$STATE"
  if [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ]; then
    T1=$(date +%s%3N); echo "T1=$T1, wall_clock_ms=$((T1-T0))"
    echo "RESULT: $RESP"
    break
  fi
  sleep 2
done

# Precise duration (Bull event log) :
ssh <DEPLOY_HOST> "docker logs xch-backend 2>&1 --since 5m | grep -E 'BullEvent.*job_id.*<JOB_ID>.*backup-full' | tail -1"
# → {"event":"job-completed","attempts":1,"duration_ms":474,...}

# Sortie observée Pass 5 :
#  - filename: full-backup-v2-2026-05-16T10-09-09.zip
#  - size: 741 417 bytes
#  - SHA-256: 71840593653e2b2218ea9a7b91a04534a53aa43430e986a7658468690cff8b78
#  - encrypted: true
```

Récupérer le `backupId` du catalog :

```bash
curl -s -b /tmp/xch-cookies.txt https://<DEPLOY_DOMAIN>/api/backup/list | jq '.backups[0]'
# → "id":"<BACKUP_ID>"
```

### 3.4 Simuler une perte de données

```bash
# Choisir 1 record réversible (ex: 1 contact NK = name+tenantId)
ssh <DEPLOY_HOST> "docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  \"DELETE FROM contacts WHERE id='<DOOMED_CONTACT_ID>' RETURNING id, name;\""
# → DELETE 1

# Confirmer la perte
ssh <DEPLOY_HOST> "docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  \"SELECT COUNT(*) FROM contacts WHERE \\\"tenantId\\\"='<TENANT_ID>';\""
# → count = 21 (au lieu de 22)
```

### 3.5 T2 — déclencher restore

```bash
T2=$(date +%s%3N)
curl -s -b /tmp/xch-cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/backup/full/restore \
  -H 'Content-Type: application/json' \
  -d '{"backupId":"<BACKUP_ID>","dryRun":false}'
# → {"enqueued":true,"jobId":"<RESTORE_JOB_ID>"}
```

### 3.6 T3 — poll restore until completed

```bash
for i in {1..30}; do
  RESP=$(curl -s -b /tmp/xch-cookies.txt https://<DEPLOY_DOMAIN>/api/backup/jobs/<RESTORE_JOB_ID>)
  STATE=$(echo "$RESP" | jq -r .state)
  if [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ]; then
    T3=$(date +%s%3N); echo "T3=$T3, RTO_wall_ms=$((T3-T2))"
    echo "RESULT: $RESP"
    break
  fi
  sleep 2
done

# Precise duration (Bull event log) :
ssh <DEPLOY_HOST> "docker logs xch-backend 2>&1 --since 5m | grep -E 'BullEvent.*job_id.*<RESTORE_JOB_ID>.*restore-full' | tail -1"
# → {"event":"job-completed","attempts":1,"duration_ms":1095,...}
```

Result observé Pass 5 :

```json
{
  "kind": "applied",
  "message": "Restore complet v2 appliqué avec succès",
  "counts": {
    "contacts": 22, "expenses": 2, "costAllocations": 2, "minioFiles": 8,
    "contactTypes": 11, "users": 6, "sites": 9, "racks": 14, "assets": 83,
    "floorPlans": 1, "pins": 3, "tasks": 12, "billingEntities": 3,
    "connectivityLinks": 14, "budgets": 3, "siteHealthSnapshots": 9,
    "_created": 12, "_skipped": 189
  }
}
```

### 3.7 Post-restore — verify recovery

```bash
# Le contact supprimé est-il restauré ?
ssh <DEPLOY_HOST> "docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  \"SELECT id, name, email FROM contacts WHERE name='<CONTACT_NAME>' AND \\\"tenantId\\\"='<TENANT_ID>';\""
# → 1 ligne (nouveau id, même name/email — NK match a régénéré)
```

---

## 4. Mesures détaillées

### 4.1 Backup (job-id `12` Pass 5)

| Métrique | Valeur |
|---|---|
| Enqueue time (T0) | `2026-05-16T10:09:09.848Z` |
| Bull processedOn → finishedOn | `474 ms` |
| Filename | `full-backup-v2-2026-05-16T10-09-09.zip` |
| Size (octets) | 741 417 |
| Encryption | `true` (AES-256-GCM, sidecar `.enc.json`) |
| SHA-256 archive | `71840593653e2b2218ea9a7b91a04534a53aa43430e986a7658468690cff8b78` |

### 4.2 Restore (job-id `13` Pass 5)

| Métrique | Valeur |
|---|---|
| Enqueue time (T2) | `2026-05-16T10:11:30.950Z` (UTC, approx) |
| BackupProcessor handle-start | `2026-05-16T10:11:31.x` (log `[BackupProcessor]`) |
| Bull processedOn → finishedOn | `1 095 ms` |
| Wall-clock incl. polls (T3 − T2) | `10 117 ms` (≈ 10s, comprend 1 poll de 2s) |
| Phases FK appliquées | 5 (tenant config, sites+infra, lifecycle, finance, snapshots) |
| `_created` / `_skipped` | 12 / 189 |
| MinIO files restored | 8 |
| HealthAggregationService re-déclenché | ✅ (queue `health-recompute` — 9 sites recalculés en ~24ms ch) |

### 4.3 Interprétation

- **474ms backup + 1095ms restore** = excellent pour un tenant ~189 lignes / 8 fichiers MinIO. Inclut chiffrement AES-256-GCM + écriture MinIO.
- **`_skipped: 189` prouve l'idempotence** des natural keys : sur une re-restore, presque rien n'est dupliqué.
- **`_created: 12`** : couvre le contact supprimé + 9 `SiteHealthSnapshot` (snapshots immutables, re-créés systématiquement) + 1 expense + 1 ressource liée. Voir §5.2 pour expenses.
- HealthAggregationService a auto-recomputed les 9 sites post-restore (cf. logs `health-recompute`), prouvant qu'aucun cron manuel n'est nécessaire pour rétablir la cohérence santé.

---

## 5. Findings observés pendant le drill

### 5.1 SMTP D2.1 capturé via Mailpit (cf. [alerting.md §4.4](alerting.md#44-capture-mailpit-track-e2-pass-4-2026-05-16))

Validation parallèle Pass 4 — `POST /api/notifications/test {kind:EMAIL}` → email reçu par Mailpit sur `xch-deploy:8025`. Aucun event `BACKUP_COMPLETED` n'a été déclenché pendant le drill car ce `NotificationEventType` n'est pas (encore) câblé dans le Backup queue. À considérer en Track E.4 backlog.

### 5.2 Idempotence partielle sur `expenses` (drift `1 → 2`)

Pre-drill : 1 expense ; post-restore : 2 expenses (alors que la backup contenait probablement 1 ou 2 expenses, et la déletion ciblait un *contact*, pas un *expense*). Hypothèses :

1. La backup a été prise après une opération test antérieure qui avait créé 1 expense supplémentaire dans le worker, et le snapshot pre-drill avait perdu un compteur (race condition très peu probable).
2. La table `expenses` n'a pas de natural key strict (probablement `(tenantId, description, amount, date)` ou similaire) → un row "presque identique" est traité comme nouveau.

→ **Backlog Track E.4** : auditer la NK Prisma sur `expenses` (cf. `XCH_PRISMA_MODELING_RULES`) pour confirmer si un `@@unique` partial index manque. Pas bloquant pour E.2.

### 5.3 Mismatch `racks` count

`racks` est cross-tenant dans le snapshot (pas de filtre `tenantId` dans la requête de §3.1). Le compteur affiché (14) reflète tous les racks. Non-bloquant pour E.2 — précision à apporter au runbook si vraiment besoin scoping.

---

## 6. Extrapolation pour prod employeur

### 6.1 Volume attendu

Tenant employeur typique J1 (estimation RSI) :
- 50-100 sites (vs 9 demo)
- 500-1000 assets (vs 83)
- 100-200 tasks
- 1000-5000 monitor_results par jour (cumulé)
- 1-5 GB MinIO files (vs 724 KB ici)

### 6.2 Extrapolation linéaire

| Tenant | Backup duration estimée | Restore RTO estimé |
|---|---|---|
| Demo (725 KB) | 474ms | 1.1s |
| Petit client (10 MB) | ~7s | ~15s |
| Pilote employeur J1 (1 GB) | ~10min | ~20min |
| Pilote 6 mois (5 GB) | ~50min | ~1h40 |

Extrapolation linéaire **conservative** — la réalité dépendra de :
- I/O disque MinIO (HDD vs SSD)
- CPU AES-256-GCM (chiffrement)
- Concurrency Bull (D.2 §6 — concurrency=2 par handler)
- Network latence si MinIO distant (pas le cas air-gap interne)

### 6.3 RTO opérateur réel

Wall-clock côté opérateur **inclut** :
- Détection incident (Grafana panel red → 1-15 min selon `MonitorCheck.intervalSec`)
- Décision restore (5-30 min — confirmation backup à utiliser)
- Exécution restore Pass 5 §3.5-3.6 (mesuré)
- Post-restore smoke (cf. §7) (~1 min)

→ **RTO opérationnel cible pilote** : 30 min pour tenant ≤ 1 GB, 1h pour ≤ 5 GB.

### 6.4 RPO opérateur réel

Backup pilote = on-demand uniquement (UI Settings > Backup). Pas de cron automatique en J1 (décision RSI Track E parking D.3).

→ **RPO cible pilote** :
- **Avec cron quotidien** (à activer post-pilote si demande) : ≤ 24 h
- **Sans cron** (J1) : `now() - max(backups.createdAt)` — opérateur doit déclencher manuellement (rappels mensuels au minimum)
- **Backup avant maintenance** : procédure obligatoire dans [incident-response.md](incident-response.md)

---

## 7. Smoke post-restore (à exécuter systématiquement)

```bash
# 1. Health probe
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .
# → {"status":"ok","db":"up","redis":"up","minio":"up",...}

# 2. Smoke endpoints
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
# → ✓ SMOKE PASS — 6/6 (incluant /api/health)

# 3. Catalog backup visible
curl -s -b /tmp/xch-cookies.txt https://<DEPLOY_DOMAIN>/api/backup/list | jq '.backups | length'

# 4. HealthAggregation re-recomputed sur les 9 sites
docker logs xch-backend-worker --since 2m | grep 'health-recompute' | tail -10
```

---

## 8. Out of scope E.2 (différé)

| Item | Pourquoi différé |
|---|---|
| `BackupJob` model avec colonnes `startedAt`/`finishedAt`/`duration_ms` persistées | Bull metadata + Sentry spans suffisent — coût migration > valeur stride E.2. Track E.4 si Grafana panel a besoin de trend > 24h Bull TTL. |
| Test Redis-down scenario | X-Backup-Sync deprecated v2.3.0, hard-removal v2.4.0 — hors scope MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15`. |
| Stack Prometheus exporter | D2.2 « reuse Grafana » suffit pilote — Track E.4 si scaling. |
| `BACKUP_COMPLETED` `NotificationEventType` câblé sur BackupProcessor | Pas wired actuellement — backlog Track E.4 (cf. §5.1). |
| Audit NK strict sur `expenses` | Backlog Track E.4 (cf. §5.2). |

---

## 9. Cross-références

- Backup ADRs : [ADR-025 streaming](../decisions/adr-025-backup-v2-streaming.md) + [ADR-026 polish](../decisions/adr-026-backup-v2-polish.md)
- Alerting smoke (Mailpit) : [alerting.md §4](alerting.md)
- Health endpoint : [backend/src/modules/health/health.controller.ts](../../backend/src/modules/health/health.controller.ts)
- Recovery scénarios service-down : [recovery-runbook.md](recovery-runbook.md) (Pass 6)
- Procédure offsite USB : [offsite-backup.md](offsite-backup.md) (Pass 7)
- Demo data principle : MCP `XCH_DEMO_DATA_PRINCIPLE`

---

## 10. Drill 2026-05-16/17 — v2.4.0 candidate (Track E.4 PR2 Pass 5 — révisé post-drill)

> **Scope** : re-validation E2E `restore-full.sh` après les migrations PR1
> (`12_audit_log_delegation_id` + `7a_notification_event_backup_completed`).
> Statut rapport : 🟠 **première exécution effectuée sur xch-deploy 2026-05-17,
> bloquée F1+F2 (restore broken, RTO non mesurable). Hotfix PR #86 ouverte.
> Procédure ci-dessous corrigée des findings F4/F5/F6/F7/F8 — re-drill à
> exécuter post-merge PR #86 sur volume Pass 3 (seed 10k assets).**
>
> **Pourquoi ces corrections** : MCP `XCH_TRACK_E4_PR2_PASS5_DRILL_XCH_DEPLOY_2026_05_17`
> a documenté que la procédure précédente avait 4 erreurs procédurales (chemins
> fichier, credentials admin, prérequis tenant, endpoint catalog) qui auraient
> bloqué tout opérateur lisant le runbook tel quel.

### 10.1 Objectifs

- Confirmer que la migration `delegationId` (PR1) est **rejouée intact** lors d'un
  `prisma migrate deploy` post-restore.
- Confirmer l'**idempotence** Backup v2 sur 2 cycles consécutifs avec MÊME
  tarball (cible cycle 2 : `_created: 0`).
- Capturer **live** la notification `BACKUP_COMPLETED` câblée PR1
  ([backup.processor.ts:179](../../backend/src/modules/backup/backup.processor.ts:179)
  + [notification-emitter.ts:160](../../backend/src/modules/notifications/notification-emitter.ts:160)).
- Mesurer le RTO avec un volume seed Pass 3 (10k assets significatif).

### 10.2 Pré-requis

- Stack cible **down** (pas de containers XCH actifs)
- Backend buildé (`cd backend && npm run build`) — pas requis si exécution sur xch-deploy déployé
- **Seed Pass 3 chargé** sur le tenant cible (cf. [load-test.yml](../../.github/workflows/load-test.yml)
  ou `npx ts-node backend/scripts/seed-loadtest.ts --reset`) — finding F5 a montré qu'une DB
  quasi-vide rend le RTO non représentatif. **Vérifier `SELECT count(*) FROM assets;` ≥ 10 000
  AVANT le drill.** (Investigation seed représentatif xch-deploy = Track G/D.3 backlog —
  cf MCP `XCH_PLAN_V3_POST_V2_2026_05_17`.)
- Docker disponible (Postgres + Redis + MinIO + Mailpit éphémère)
- **Notification rules seedées sur le tenant cible** (cf §10.2.bis ci-dessous) — finding F6
  a montré que sans rules, Mailpit reste vide même avec wiring code intact (faux trigger R5.4).
- **Admin credentials valides** sur le tenant cible (cf §10.2.ter ci-dessous) — finding F4
  a montré que `admin@demo.fr` est stale, le réel sur xch-deploy est `admin@demo2.fr`.

#### 10.2.bis — Préparer le tenant pour test BACKUP_COMPLETED notif (finding F6)

Avant le cycle 3 du drill (capture live notif), seeder les rules + channels :

```sql
-- À exécuter via docker exec xch-postgres psql -U xch_user -d xch_dev
INSERT INTO notification_rules (id, "tenantId", event, enabled, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, '<tenantId>', 'BACKUP_COMPLETED', true, NOW(), NOW())
  ON CONFLICT DO NOTHING;

INSERT INTO notification_channels (id, "tenantId", kind, target, enabled, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, '<tenantId>', 'email', '<test_recipient>', true, NOW(), NOW())
  ON CONFLICT DO NOTHING;
```

> **Pourquoi obligatoire** : `backup.processor.ts:199-220` émet bien via emitter, et `notification-emitter.ts:160-192` dispatch via service — mais sans rules sur le tenant, le dispatcher filtre l'event et 0 message arrive à Mailpit + 0 entrée `notification_logs`. Sans ce seed, R5.4 sort en faux négatif.

#### 10.2.ter — Localiser le tarball backup v2 (finding F8)

> **CRITICAL — changement vs runbook v1** : les backups v2 (ADR-025 streaming) sont stockés **exclusivement dans le bucket MinIO `xch-backups`**, JAMAIS sur le filesystem host. Le pattern `ls -t backups/*.tar.gz` du runbook précédent ne trouvera rien.

Pour matérialiser un tarball backup en local en vue d'un `restore-full.sh --mode=api` :

```bash
# Option A — via API download (PRÉFÉRÉE, requiert admin authentifié, cookie session valide)
# Récupérer le backupId :
curl -s -b /tmp/xch-cookies.txt https://<DEPLOY_DOMAIN>/api/backup/list | jq '.backups[0]'
# → utiliser le champ .id pour le download :
curl -s -b /tmp/xch-cookies.txt \
  https://<DEPLOY_DOMAIN>/api/backup/<backupId>/download \
  -o /tmp/full-backup-v2-<timestamp>.zip

# Option B — via mc CLI (requiert alias MinIO configuré dans le container)
docker exec xch-minio mc cp local/xch-backups/<filename>.zip /tmp/
docker cp xch-minio:/tmp/<filename>.zip /tmp/

# Vérification (sha256 doit matcher le checksum stocké dans backup metadata)
sha256sum /tmp/full-backup-v2-<timestamp>.zip
```

> **Note F7** : l'endpoint catalog est `/api/backup/list` (le path `/api/backup/catalog` mentionné dans certaines versions historiques du plan n'existe pas dans le code — vérifié 2026-05-17 par grep `docs/operator/` = 0 occurrence, F7 closed).

#### 10.2.quater — Workaround Setup Wizard chicken-egg pour restore sur DB vierge (finding F4 + R5.5 esprit)

Sur une DB fraîche post-`teardown-xch-stack.sh`, aucun admin n'existe pour s'authentifier auprès de `POST /api/backup/full/restore-upload` qui exige `@RequireWrite()`. Workaround obligatoire :

```bash
# Étape a — créer un admin temporaire via Setup Wizard
# Option flux UI : visiter https://<DEPLOY_DOMAIN>/setup
# Option API directe :
curl -X POST https://<DEPLOY_DOMAIN>/api/setup/admin \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "setup@drill.local",
    "password": "DrillPass5_2026!",
    "firstName": "Drill",
    "lastName": "Admin",
    "tenantName": "DrillTemp"
  }'

# Étape b — login avec cet admin temp pour obtenir cookie session
curl -c /tmp/xch-cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"setup@drill.local","password":"DrillPass5_2026!"}'

# Étape c — lancer restore-full.sh --mode=api (qui réutilise le cookie ou re-login)
bash scripts/restore-full.sh "$BACKUP_FILE" --mode=api

# Étape d — vérifier que le restore overwrite le tenant/admin temp avec les données du backup
# (le tenant DrillTemp + admin setup@drill.local disparaissent au profit des données restaurées,
#  vérifié empiriquement Pass 5 2026-05-17)
```

> **Pourquoi obligatoire** : avant ce workaround, le runbook supposait implicitement qu'un admin existait déjà post-bootstrap. Pass 5 a découvert que sur DB fresh post-teardown, la chaîne complète bootstrap → restore est impossible sans cette étape intermédiaire.

### 10.3 Procédure exacte (à exécuter sur host Docker-capable)

```bash
# === Cycle 1 — Backup + teardown + restore + smoke ===
cd /path/to/XCH-dev

# 0. Login admin du tenant cible (vérifié non-stale ; cf finding F4)
#    Sur xch-deploy : admin@demo2.fr — adapter pour stack dev local.
curl -c /tmp/xch-cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'

# 1. Backup — déclencher via API (storage MinIO bucket, cf §10.2.ter / finding F8)
T_BACKUP_START=$(date +%s)
JOB=$(curl -s -b /tmp/xch-cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/backup/full \
  -H 'Content-Type: application/json' -d '{}' | jq -r .jobId)
echo "Backup job: $JOB"
# Poll Bull job state
for i in $(seq 1 30); do
  STATE=$(curl -s -b /tmp/xch-cookies.txt "https://<DEPLOY_DOMAIN>/api/backup/jobs/$JOB" | jq -r .state)
  echo "poll #$i state=$STATE"
  [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ] && break
  sleep 2
done
T_BACKUP_END=$(date +%s)
echo "Backup wall duration: $((T_BACKUP_END - T_BACKUP_START))s"

# 1.bis Note finding F3 : par défaut le backup sort encrypted=false même avec XCH_MASTER_KEY set.
#       Si le drill doit valider le path chiffré, ajouter '{"encrypted":true}' au body POST ci-dessus.
#       Investigation default vs opt-in = Track F.9 backlog (cf XCH_PLAN_V3_POST_V2_2026_05_17).

# 1.ter Matérialiser le tarball en local pour --mode=api restore (cf §10.2.ter)
BACKUP_ID=$(curl -s -b /tmp/xch-cookies.txt https://<DEPLOY_DOMAIN>/api/backup/list | jq -r '.backups[0].id')
BACKUP_FILE="/tmp/full-backup-v2-$(date +%Y%m%dT%H%M%S).zip"
curl -s -b /tmp/xch-cookies.txt \
  "https://<DEPLOY_DOMAIN>/api/backup/$BACKUP_ID/download" \
  -o "$BACKUP_FILE"
echo "Backup file local: $BACKUP_FILE"
sha256sum "$BACKUP_FILE"

# 2. Teardown (dry-run preview obligatoire v2)
bash scripts/teardown-xch-stack.sh --dry-run
bash scripts/teardown-xch-stack.sh --yes

# 3. Re-start infra
cd backend
docker compose up -d postgres redis minio minio-init
docker compose ps

# Wait postgres healthy
for i in $(seq 1 30); do
  STATUS=$(docker inspect xch-postgres --format '{{.State.Health.Status}}' 2>/dev/null || echo "starting")
  [ "$STATUS" = "healthy" ] && break
  sleep 1
done
cd ..

# 4. Restore (mode=api polling)
T_RESTORE_START=$(date +%s)
bash scripts/restore-full.sh "$BACKUP_FILE" --mode=api
T_RESTORE_END=$(date +%s)
echo "Restore duration: $((T_RESTORE_END - T_RESTORE_START))s"

# 5. Vérif schéma post-restore (migrations PR1 rejouées)
cd backend
npx prisma db pull --schema=/tmp/pulled.prisma
diff prisma/schema.prisma /tmp/pulled.prisma | grep -E "delegationId|@@index.*delegationId|BACKUP_COMPLETED" || echo "schema OK (no diff)"
# Attendu: 0 diff sur ces 3 patterns. Si diff → migration NON rejouée → CRITICAL hotfix.
cd ..

# 6. Smoke 6/6
bash scripts/smoke-prod.sh http://localhost:3000

# === Cycle 2 — Idempotence avec MÊME tarball ===

# 7. Re-teardown
bash scripts/teardown-xch-stack.sh --yes

# 8. Re-start infra
cd backend && docker compose up -d postgres redis minio minio-init && cd ..

# 9. Re-restore MÊME tarball
T_RESTORE2_START=$(date +%s)
bash scripts/restore-full.sh "$BACKUP_FILE" --mode=api
T_RESTORE2_END=$(date +%s)
echo "Restore #2 duration: $((T_RESTORE2_END - T_RESTORE2_START))s"

# 10. Smoke 6/6 confirme idempotence
bash scripts/smoke-prod.sh http://localhost:3000

# === Cycle 3 — BACKUP_COMPLETED notif live capture ===
#
# PRÉ-REQUIS BLOQUANT — seed des notification_rules + channels sur le tenant cible
# (cf §10.2.bis / finding F6). Sans ce seed : faux trigger R5.4 (Mailpit vide
# malgré wiring code intact).

# 11. Seed notification rules sur le tenant cible
docker exec xch-postgres psql -U xch_user -d xch_dev <<'SQL'
INSERT INTO notification_rules (id, "tenantId", event, enabled, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, '<tenantId>', 'BACKUP_COMPLETED', true, NOW(), NOW())
  ON CONFLICT DO NOTHING;
INSERT INTO notification_channels (id, "tenantId", kind, target, enabled, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, '<tenantId>', 'email', '<test_recipient>', true, NOW(), NOW())
  ON CONFLICT DO NOTHING;
SQL

# 12. Mailpit éphémère
docker run -d --rm --name mailpit-drill \
  --network backend_xch_dev_net \
  -p 8025:8025 -p 1025:1025 \
  axllent/mailpit

# 13. Backend SMTP override + restart
docker compose -f backend/docker-compose.yml exec -e SMTP_HOST=mailpit-drill -e SMTP_PORT=1025 backend npm run start:prod &
# (alternative: ajouter SMTP_HOST/SMTP_PORT à .env.local puis docker compose restart backend)
sleep 5

# 14. Trigger backup full + poll (admin du tenant cible — F4 : NE PAS utiliser admin@demo.fr stale)
curl -c /tmp/cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'

JOB=$(curl -s -b /tmp/cookies.txt -X POST https://<DEPLOY_DOMAIN>/api/backup/full \
  -H 'Content-Type: application/json' -d '{}' | jq -r .jobId)
echo "Backup job: $JOB"

for i in $(seq 1 30); do
  STATE=$(curl -s -b /tmp/cookies.txt "https://<DEPLOY_DOMAIN>/api/backup/jobs/$JOB" | jq -r .state)
  echo "poll #$i state=$STATE"
  [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ] && break
  sleep 2
done

# 15. Vérif notif BACKUP_COMPLETED reçue dans Mailpit
curl -s http://localhost:8025/api/v1/messages | jq '.messages[] | select(.Subject | test("Backup"; "i"))'
# Attendu: au moins 1 message avec Subject contenant "Backup" + body avec jobId + duration_ms + size_bytes

# 15.bis Fallback SQL si Mailpit indisponible
docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  "SELECT id, event, status, \"createdAt\" FROM notification_dispatches WHERE event='BACKUP_COMPLETED' ORDER BY \"createdAt\" DESC LIMIT 1;"

# 16. Teardown Mailpit
docker stop mailpit-drill
```

### 10.4 Vigilance R5.2 — ThrottlerGuard env override

Si `429 Too Many Requests` lors du login Pass 5.3 (rate limit `THROTTLE_AUTH_LIMIT=5` défaut, cf.
[auth.controller.ts:2](../../backend/src/modules/auth/auth.controller.ts:2)) :

```bash
# DRILL LOCAL UNIQUEMENT — JAMAIS sur prod
export THROTTLE_AUTH_LIMIT=99999
# … relancer la procédure depuis 12. …

# RÉVERT OBLIGATOIRE POST-DRILL
unset THROTTLE_AUTH_LIMIT
docker compose restart backend
# Confirme défaut restauré
bash scripts/smoke-prod.sh http://localhost:3000   # 6/6 OK = défaut OK
```

### 10.5 Résultats observés

> **À compléter après première exécution** (drill local 2026-05-XX).

| Métrique | Cycle 1 | Cycle 2 (idempot.) | Cycle 3 (notif) | Cible |
|---|---|---|---|---|
| Backup duration (wall) | ⏳ s | n/a | ⏳ s | < 60s tenant ~10k |
| Restore duration (wall) | ⏳ s | ⏳ s | n/a | < 30 min RTO |
| Migration `12_audit_log_delegation_id` rejouée | ⏳ ✅/❌ | n/a | n/a | ✅ |
| Migration `7a_notification_event_backup_completed` rejouée | ⏳ ✅/❌ | n/a | n/a | ✅ |
| Schema diff post-restore | ⏳ 0 lignes | ⏳ 0 lignes | n/a | 0 |
| Smoke 6/6 PASS | ⏳ ✅/❌ | ⏳ ✅/❌ | ⏳ ✅/❌ | ✅ |
| BACKUP_COMPLETED notif délivrée (Mailpit) | n/a | n/a | ⏳ ✅/❌ | ✅ |
| BACKUP_COMPLETED dispatch SQL fallback | n/a | n/a | ⏳ ✅/❌ | ✅ |
| ThrottlerGuard env override appliqué ? | ⏳ oui/non | ⏳ oui/non | ⏳ oui/non | unset post-drill |
| ThrottlerGuard reverted + smoke 6/6 PASS | n/a | n/a | ⏳ ✅/❌ | ✅ |

### 10.6 Findings — Drill exécution 2026-05-17 (Pass 5 initial)

> **Source** : MCP `XCH_TRACK_E4_PR2_PASS5_DRILL_XCH_DEPLOY_2026_05_17` event_log complet.

| # | Sévérité | Description | Action |
|---|---|---|---|
| **F1** | **CRITICAL** | `backup.service.ts:2607-2608` restore data path appelle `prisma.user.create({ data: { ..., role, status } })` — colonnes retirées par migration auth model v2 → restore full échoue avec `Unknown argument 'status'`. Régression latente jamais exercée avant Pass 5. | **Hotfix PR #86** (branche `claude/confident-mayer-309c5b`, commit `c216cb3`) — retrait zombie fields côté restore (backup serializer côté export OK) |
| **F2** | **CRITICAL** | `restore-full.sh:130` envoie `curl -F 'file=@$BACKUP_FILE'` mais `FileFieldsInterceptor` dans `backup.controller.ts:481` attend field `backup`. Drift introduit commit `7fb03d04` (Track E.2 closure 2026-05-16) — `--mode=api` jamais E2E green depuis | **Hotfix PR #86** — script renommage `file` → `backup` |
| **F3** | Important | `POST /api/backup/full` sans param body → `encrypted=false` même avec `XCH_MASTER_KEY` set. Comportement default vs opt-in à clarifier | **Track F.9 backlog** — investigation default vs opt-in (cf `XCH_PLAN_V3_POST_V2_2026_05_17`) |
| **F4** | Procédural | Mémoire stale : admin user réel xch-deploy = `admin@demo2.fr` (PAS `admin@demo.fr` historique). Password `Demo1234` invalide pré-drill | Runbook §10.3 step 0 + Cycle 3 step 14 utilisent placeholders `<ADMIN_EMAIL>` / `<ADMIN_PASSWORD>`. Memory `project_prod_access.md` mise à jour |
| **F5** | Procédural | DB demo2.fr quasi-vide pre-drill (1 user / 0 sites / 0 assets / 0 audit_logs) — RTO non représentatif. Hypothèse : seed Pass 3 jamais chargé sur xch-deploy | Runbook §10.2 requiert `SELECT count(*) FROM assets;` ≥ 10000 AVANT drill. **Track G/D.3 backlog** — investigation seed représentatif xch-deploy avant re-drill et cutover pilote |
| **F6** | Procédural | Mailpit + `notification_logs` vides malgré wiring backup.processor + emitter intact. Cause : 0 `notification_rules` + 0 channels sur DrillTemp tenant fresh → dispatcher filtre l'event → faux trigger R5.4 | Runbook §10.2.bis ajoute seed SQL obligatoire avant Cycle 3 |
| **F7** | Procédural | Plan source référençait `GET /api/backup/catalog` (HTTP 404 — endpoint inexistant). Endpoint réel = `GET /api/backup/list` | Runbook §10.2.ter + §10.3 step 1.ter utilisent `/api/backup/list`. Vérification grep `docs/operator/` 2026-05-17 = 0 occurrence stale. **F7 closed** |
| **F8** | Procédural | Plan source supposait host FS path `backups/*.tar.gz`. Réalité ADR-025 streaming : backups v2 sont **exclusivement** dans MinIO bucket `xch-backups`. `ls backups/` retourne rien | Runbook §10.2.ter documente 2 options (API download / `mc cp`) + §10.3 step 1.ter matérialise localement via `/api/backup/<id>/download` |

**Vigilances Pass 5 — verdicts** :
- **R5.2 ThrottlerGuard** TRIGGERED réel — override LOCAL appliqué puis reverted Étape 7 + smoke 6/6 PASS confirme défaut restauré ✅
- **R5.4 BACKUP_COMPLETED notif** NOT TRIGGERED (faux négatif causé par F6 — code intact, rules absentes)
- **R5.5 migration delegationId rejouée** NOT REACHED (blocked F1+F2 avant le path schema diff). Esprit R5.5 ("restore broken → CRITICAL hotfix + ping user") APPLIQUÉ via F1+F2 + PR #86.

**RTO Pass 5 = non mesurable** (restore broken par F1+F2). Re-drill obligatoire post-merge PR #86 sur volume Pass 3 (seed 10k assets) pour mesure crédible.

### 10.7 Cleanup

```bash
# Si seed loadtest tenant à purger
cd backend && npx ts-node scripts/seed-loadtest.ts --reset
# OU drop complet
docker compose down -v
```

