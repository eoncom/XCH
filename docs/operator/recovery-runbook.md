# XCH — Recovery runbook (service-down scenarios) — Track E.2 Pass 6

> **Scope** : procédures opérateur quand un container de la stack XCH tombe (Postgres / Redis / MinIO / backend). Validation Pass 6 Track E.2 — pattern compatible avec backup v2 ZIP + `/api/health` (Pass 2) comme sonde primaire.
> **Placeholders Option C** : `<DEPLOY_DOMAIN>`, `<DEPLOY_HOST>`, `<COMPOSE_DIR>` (par ex. `/opt/<DEPLOY_DIR>`).

---

## 0. Détection commune

```bash
# 1. Sonde infra (canonical)
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .
# 200 + status:ok  → tout va bien
# 503 + degraded   → au moins une dépendance down — voir details.{db|redis|minio}

# 2. Smoke endpoints (6/6 attendus)
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>

# 3. Container status
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && docker compose ps"
```

Grafana panel `/api/health` (cf. [alerting.md §3.2 panel 4](alerting.md#34-4-panel-4--apihealth-probe-http-infinity-plugin-polling-60s)) alerte automatiquement sur 503.

---

## 1. Scénario A — Postgres down

### 1.1 Symptômes

- `/api/health` → 503, `details.db.status = "down"`, `error` souvent `ECONNREFUSED <host>:5432` ou `timeout`
- Backend logs : `PrismaClientInitializationError`
- Worker logs : Bull jobs en `delayed` queue (impossible de consommer)

### 1.2 Détection

```bash
ssh <DEPLOY_HOST> "docker compose -f <COMPOSE_DIR>/docker-compose.yml ps postgres"
# Si Status != "Up (healthy)" → confirmer
ssh <DEPLOY_HOST> "docker compose -f <COMPOSE_DIR>/docker-compose.yml logs postgres --tail 50"
```

### 1.3 Recovery

```bash
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && docker compose restart postgres"

# Attendre healthcheck pg_isready (max 30s, healthcheck interval 5s × 5 retries)
ssh <DEPLOY_HOST> "for i in {1..30}; do
  STATUS=\$(docker inspect xch-postgres --format '{{.State.Health.Status}}')
  echo \"poll #\$i status=\$STATUS\"
  [[ \"\$STATUS\" == \"healthy\" ]] && break
  sleep 1
done"
```

### 1.4 Validation post-restart

```bash
# 1. Schema cohérent (migrations en place)
ssh <DEPLOY_HOST> "docker exec xch-backend npx prisma migrate status 2>&1 | tail -10"
# attendu : "Database schema is up to date"

# 2. Health probe → ok
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .status
# → "ok"

# 3. Smoke
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
```

### 1.5 Si schema corrompu ou migrations incohérentes

```bash
# CRITICAL : data loss probable — confirmer avec un backup récent disponible
ssh <DEPLOY_HOST> "curl -s -b cookies.txt https://<DEPLOY_DOMAIN>/api/backup/list | jq '.backups[0]'"

# Restore depuis backup v2 — voir docs/operator/dr-drill.md §3
bash scripts/restore-full.sh <backup.zip> [<sidecar.enc.json>]
```

---

## 2. Scénario B — Redis down

### 2.1 Symptômes

- `/api/health` → 503, `details.redis.status = "down"`, `error` = `ECONNREFUSED <host>:6379`
- Backend continue de servir les routes HTTP (Bull queue ne bloque pas les requêtes synchrones)
- **Worker** : aucun job traité (Bull broker indisponible)
- **Backup/Restore** : `/api/backup/full` retourne 500 (impossible d'enqueue)

### 2.2 Détection

```bash
ssh <DEPLOY_HOST> "docker compose ps redis"
ssh <DEPLOY_HOST> "docker compose logs redis --tail 30"
```

### 2.3 Recovery

```bash
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && docker compose restart redis"

# Attendre healthcheck
ssh <DEPLOY_HOST> "for i in {1..15}; do
  STATUS=\$(docker inspect xch-redis --format '{{.State.Health.Status}}')
  [[ \"\$STATUS\" == \"healthy\" ]] && break
  sleep 1
done && echo final=\$STATUS"
```

### 2.4 Validation post-restart

```bash
# 1. Health → ok
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .

# 2. Bull queues réacceptent — déclencher un dry-run backup
bash -c "
COOK=\$(mktemp)
curl -s -c \$COOK -X POST https://<DEPLOY_DOMAIN>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"<ADMIN_EMAIL>\",\"password\":\"<ADMIN_PASSWORD>\"}' > /dev/null
curl -s -b \$COOK -X POST https://<DEPLOY_DOMAIN>/api/backup/full -H 'Content-Type: application/json' -d '{\"dbOnly\":true}'
rm \$COOK
"
# → {\"enqueued\":true,\"jobId\":\"...\"}
```

### 2.5 Jobs en cours pendant la panne

- **Pre-v2.3.0** (X-Backup-Sync force sync) : jobs en cours échouent silencieusement.
- **v2.3.0+** : Bull retry par défaut désactivé (1 attempt only) — un job en cours pendant la panne sera `failed`. Re-lancer manuellement après recovery via UI Settings > Backup.

---

## 3. Scénario C — MinIO down

### 3.1 Symptômes

- `/api/health` → 503, `details.minio.status = "down"`, `error` = `HTTP 503` ou `fetch failed`
- Uploads échouent (assets, photos, plans, attachments)
- Backup création échoue (impossible d'écrire dans `xch-backups`)
- Restore échoue (impossible de download depuis catalog OU multipart upload échoue côté fileFields)

### 3.2 Détection

```bash
ssh <DEPLOY_HOST> "docker compose ps minio"
ssh <DEPLOY_HOST> "docker compose logs minio --tail 30"
ssh <DEPLOY_HOST> "curl -s http://localhost:9000/minio/health/live -w '%{http_code}\n'"
```

### 3.3 Recovery

```bash
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && docker compose restart minio"

# Attendre healthcheck (interval 10s, retries 3)
ssh <DEPLOY_HOST> "for i in {1..30}; do
  STATUS=\$(docker inspect xch-minio --format '{{.State.Health.Status}}')
  [[ \"\$STATUS\" == \"healthy\" ]] && break
  sleep 1
done && echo final=\$STATUS"
```

### 3.4 Validation post-restart

```bash
# 1. Health → ok
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .

# 2. Catalog backup visible
curl -s -b cookies.txt https://<DEPLOY_DOMAIN>/api/backup/list | jq '.backups | length'
# > 0 attendu

# 3. Buckets accessibles depuis container backend
ssh <DEPLOY_HOST> "docker exec xch-backend node -e \"
const {Client} = require('minio');
const c = new Client({endPoint:'minio',port:9000,useSSL:false,accessKey:process.env.MINIO_ACCESS_KEY,secretKey:process.env.MINIO_SECRET_KEY});
['xch-storage','xch-backups','xch-plans','xch-photos','xch-exports','xch-qrcodes'].forEach(b => c.bucketExists(b).then(r=>console.log(b,r)).catch(e=>console.log(b,'ERR',e.message)));
\""
```

### 3.5 Si MinIO data volume corrompu

```bash
# CRITICAL : objects perdus — restore depuis backup v2 (qui inclut les buckets)
# La table catalog backupJobs reste dans Postgres (intacte). Choisir le plus récent :
ssh <DEPLOY_HOST> "docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  \"SELECT id, \\\"createdAt\\\" FROM backup_jobs WHERE status='COMPLETED' ORDER BY \\\"createdAt\\\" DESC LIMIT 5;\""

# Restaurer (multipart si le ZIP est offsite USB) — voir dr-drill.md §3
bash scripts/restore-full.sh <backup.zip>
```

---

## 4. Scénario D — Backend container crashed/loop

### 4.1 Symptômes

- `/api/health` → connection refused (curl `Failed to connect`)
- Frontend pages rendent un 502/503 (NPM upstream KO)
- `docker compose ps backend` → `Restarting`

### 4.2 Recovery

```bash
ssh <DEPLOY_HOST> "docker compose logs backend --tail 100"
# Identifier l'erreur fatale au boot

# Cas 1 : OOM (out of memory)
ssh <DEPLOY_HOST> "docker stats xch-backend --no-stream"
# Vérifier limites compose (mem_limit), augmenter si besoin

# Cas 2 : Prisma client out of sync avec DB schema
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && docker compose run --rm backend npx prisma migrate status"
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && docker compose run --rm backend npx prisma migrate deploy"

# Cas 3 : .env manquant ou variable critique manquante
ssh <DEPLOY_HOST> "docker exec xch-backend printenv | grep -E '^(DATABASE_URL|REDIS_HOST|MINIO_)' | sed 's|=.*|=<set>|'"

# Cas 4 : crash applicatif post-déploiement → rollback
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && git log --oneline -5 -- backend/"
# Identifier le dernier commit propre et revert :
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && git checkout <PREVIOUS_TAG> && docker compose build backend backend-worker && docker compose up -d backend backend-worker"
```

### 4.3 Validation

```bash
# Health probe accessible
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .
# Smoke
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
```

---

## 5. Scénario E — Worker container down (backend OK, mais aucun job traité)

### 5.1 Symptômes

- `/api/health` reste à 200 (le worker n'est pas dans les probes — seul le backend l'est)
- Backup/restore enqueué mais jamais traité (state reste `waiting` ou `active` indéfiniment)
- File de queue Bull grandit : `keys backup-jobs:*` dans Redis

### 5.2 Détection

```bash
ssh <DEPLOY_HOST> "docker compose ps backend-worker"
# Statut ou redémarrage en boucle ?

# Worker alive sentinel (touchfile pattern)
ssh <DEPLOY_HOST> "docker exec xch-backend-worker stat -c %Y /tmp/xch-worker-alive 2>/dev/null"
# Doit être < 60s old
```

### 5.3 Recovery

```bash
ssh <DEPLOY_HOST> "cd <COMPOSE_DIR> && docker compose restart backend-worker"

# Validation : un job de test
ssh <DEPLOY_HOST> "docker exec xch-backend-worker node -e \"
const Q = require('bull');
const q = new Q('backup-jobs', { redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT } });
q.getJobCounts().then(c => { console.log(c); process.exit(0); });
\""
```

---

## 6. Scénario F — VM entière perdue / migration

Hors scope service-down — voir [docs/operator/dr-drill.md](dr-drill.md) §3 (full bootstrap → restore) et [scripts/install-airgap.sh](../../scripts/install-airgap.sh).

Pré-requis : avoir le ZIP backup (et éventuellement le sidecar `.enc.json`) sur un médium externe — voir [docs/operator/offsite-backup.md](offsite-backup.md) Pass 7 (USB LUKS).

---

## 7. Post-recovery — checklist générique

Après n'importe quel scénario :

- [ ] `/api/health` → 200 `status:ok`
- [ ] `bash scripts/smoke-prod.sh` → PASS 6/6
- [ ] `docker compose ps` → tous containers `Up (healthy)`
- [ ] Grafana panel uptime 24h (cf. [alerting.md §3.2 panel 1](alerting.md#31-panel-1--uptime--24h-par-check-stat-panel-agrégat-global)) : retour à > 99%
- [ ] Un MONITOR_DOWN/UP event est passé sur le canal email (cf. [alerting.md §4](alerting.md))
- [ ] Audit log entry pour l'incident (manuel — créer une note dans `docs/operator/incident-response.md` post-mortem)
- [ ] Si data loss confirmée : déclencher backup immédiat avant de revenir à un cycle normal

---

## 8. Cross-références

- Sonde santé : [backend/src/modules/health/health.controller.ts](../../backend/src/modules/health/health.controller.ts)
- Restore script v2 : [scripts/restore-full.sh](../../scripts/restore-full.sh)
- DR drill mesuré : [dr-drill.md](dr-drill.md)
- Alerting + monitoring : [alerting.md](alerting.md)
- Incident response (post-mortem template) : [incident-response.md](incident-response.md)
- ADR backup v2 : [adr-025](../decisions/adr-025-backup-v2-streaming.md) + [adr-026](../decisions/adr-026-backup-v2-polish.md)

---

## 9. Migration v2.4.0 — timing attendu (Track E.4 PR2 Pass 5)

Track E.4 PR1 a introduit 2 migrations Prisma qui se rejouent automatiquement à
chaque `prisma migrate deploy` (boot backend container) et donc à chaque restore
ZIP v2 :

| Migration | Opération | Coût attendu | Sensibilité volume |
|---|---|---|---|
| `12_audit_log_delegation_id` | `ALTER TABLE audit_logs ADD COLUMN delegationId TEXT NULL` + FK + index composite `(tenantId, delegationId, timestamp)` | ~120ms sur 10k AuditLog (mesuré seed Pass 3) | **Linéaire** sur volume `audit_logs` — extrapoler à `~1.2ms / 1k rows` pour pilote (1M AuditLog ≈ ~1.2s acceptable) |
| `7a_notification_event_backup_completed` | `ALTER TYPE NotificationEventType ADD VALUE 'BACKUP_COMPLETED'` | ~30ms | Constant (DDL enum) |

**Total migration cost post-restore** : ~150ms typique stack dev local, jamais
bloquant.

**Vigilance R5.1** : si `audit_logs` volume > 1M rows et migration > 5s
observée → backlog Track G (analyse `EXPLAIN ANALYZE` pour le CREATE INDEX, peut
nécessiter `CREATE INDEX CONCURRENTLY` en deploy prod live — non-applicable au
contexte restore puisque la base est vide au moment du replay).

### 9.1 Validation schéma post-restore

Après tout `restore-full.sh`, vérifier que les 2 migrations sont en place :

```bash
# Diff prisma schema (devrait être vide)
cd backend
npx prisma db pull --schema=/tmp/pulled.prisma
diff prisma/schema.prisma /tmp/pulled.prisma | grep -E 'delegationId|@@index.*delegationId|BACKUP_COMPLETED'
# Attendu : aucune sortie (les 3 patterns sont présents identiques)

# OU via psql direct
docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name='audit_logs' AND column_name='delegationId';"
# Attendu : 1 ligne (delegationId)

docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  "SELECT unnest(enum_range(NULL::\"NotificationEventType\"))::text
   WHERE unnest(enum_range(NULL::\"NotificationEventType\"))::text = 'BACKUP_COMPLETED';"
# Attendu : 1 ligne (BACKUP_COMPLETED)

docker exec xch-postgres psql -U xch_user -d xch_dev -c \
  "SELECT indexname FROM pg_indexes
   WHERE tablename='audit_logs' AND indexname LIKE '%delegationId%';"
# Attendu : audit_logs_tenantId_delegationId_timestamp_idx
```

Si l'une de ces 3 assertions échoue post-restore → **CRITICAL** : la migration
n'a pas été rejouée, audit log enrichment ADR-028 ne fonctionne plus, hotfix
restore script obligatoire (R5.5 vigilance Track E.4 PR2).
