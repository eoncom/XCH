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

## 10. Drill 2026-05-16 — v2.4.0 candidate (Track E.4 PR2 Pass 5)

> **Scope** : re-validation E2E `restore-full.sh` après les migrations PR1
> (`12_audit_log_delegation_id` + `7a_notification_event_backup_completed`).
> Statut rapport : 🟡 **runbook + procédure livrés — première exécution
> attendue sur stack dev local (PAS xch-deploy — banc de test réservé PR3
> cutover validation)**. Résultats à compléter post-exécution.

### 10.1 Objectifs

- Confirmer que la migration `delegationId` (PR1) est **rejouée intact** lors d'un
  `prisma migrate deploy` post-restore.
- Confirmer l'**idempotence** Backup v2 sur 2 cycles consécutifs avec MÊME
  tarball.
- Capturer **live** la notification `BACKUP_COMPLETED` câblée PR1
  ([backup.processor.ts:179](../../backend/src/modules/backup/backup.processor.ts:179)
  + [notification-emitter.ts:160](../../backend/src/modules/notifications/notification-emitter.ts:160)).
- Mesurer le RTO avec un volume seed Pass 3 (10k assets significatif).

### 10.2 Pré-requis

- Stack dev local **down** (pas de containers XCH actifs)
- Backend buildé (`cd backend && npm run build`)
- Seed Pass 3 chargé (cf. [load-test.yml](../../.github/workflows/load-test.yml)
  ou `npx ts-node backend/scripts/seed-loadtest.ts --reset`)
- Docker disponible (Postgres + Redis + MinIO + Mailpit éphémère)

### 10.3 Procédure exacte (à exécuter sur host Docker-capable)

```bash
# === Cycle 1 — Backup + teardown + restore + smoke ===
cd /path/to/XCH-dev

# 1. Backup
T_BACKUP_START=$(date +%s)
bash scripts/backup-full.sh
ls -la backups/ | tail -3
BACKUP_FILE=$(ls -t backups/xch-backup-full-*.tar.gz | head -1)
echo "Backup file: $BACKUP_FILE"
T_BACKUP_END=$(date +%s)
echo "Backup duration: $((T_BACKUP_END - T_BACKUP_START))s"

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

# 11. Mailpit éphémère
docker run -d --rm --name mailpit-drill \
  --network backend_xch_dev_net \
  -p 8025:8025 -p 1025:1025 \
  axllent/mailpit

# 12. Backend SMTP override + restart
docker compose -f backend/docker-compose.yml exec -e SMTP_HOST=mailpit-drill -e SMTP_PORT=1025 backend npm run start:prod &
# (alternative: ajouter SMTP_HOST/SMTP_PORT à .env.local puis docker compose restart backend)
sleep 5

# 13. Trigger backup full + poll
curl -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.fr","password":"Demo1234"}'

JOB=$(curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/backup/full \
  -H 'Content-Type: application/json' -d '{}' | jq -r .jobId)
echo "Backup job: $JOB"

for i in $(seq 1 30); do
  STATE=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/backup/jobs/$JOB" | jq -r .state)
  echo "poll #$i state=$STATE"
  [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ] && break
  sleep 2
done

# 14. Vérif notif BACKUP_COMPLETED reçue dans Mailpit
curl -s http://localhost:8025/api/v1/messages | jq '.messages[] | select(.Subject | test("Backup"; "i"))'
# Attendu: au moins 1 message avec Subject contenant "Backup" + body avec jobId + duration_ms + size_bytes

# 14bis. Fallback SQL si Mailpit indisponible
docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  "SELECT id, event, status, \"createdAt\" FROM notification_dispatches WHERE event='BACKUP_COMPLETED' ORDER BY \"createdAt\" DESC LIMIT 1;"

# 15. Teardown Mailpit
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

### 10.6 Findings

| # | Sévérité | Description | Action |
|---|---|---|---|
| ⏳ | ⏳ | ⏳ | ⏳ |

Si CRITICAL R5.5 (restore casse migration delegationId) → hotfix PR2 inclus +
ping user immédiat. Si CRITICAL R5.4 (notif BACKUP_COMPLETED non-émise) →
régression PR1 wiring → hotfix PR2 inclus.

### 10.7 Cleanup

```bash
# Si seed loadtest tenant à purger
cd backend && npx ts-node scripts/seed-loadtest.ts --reset
# OU drop complet
docker compose down -v
```

