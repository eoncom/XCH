# XCH — Alerting & Monitoring (operator runbook)

> **Scope** : décisions opérationnelles RSI Track E.2 — D2.1 SMTP interne Postfix relay, D2.2 Prometheus + Grafana self-hosted (réutilisé), D2.4 syslog local (pas de SIEM J1).
> **Placeholders Option C mixte** : `<DEPLOY_DOMAIN>`, `<SMTP_RELAY>`, `<ADMIN_EMAIL>`, `<GRAFANA_HOST>`, `<XCH_GRAFANA_RO_PASS>`.

---

## 1. Vue d'ensemble

| Domaine | Source | Sink | Décision |
|---|---|---|---|
| **Erreurs runtime** | Backend + Worker + Frontend (Sentry SDK) | GlitchTip self-hosted (ADR-024) | Actif depuis v2.1.0 — cf. [docs/audit/track-e2-glitchtip-state.md](../audit/track-e2-glitchtip-state.md) |
| **Métriques infrastructure** | PostgreSQL `monitor_checks`+`monitor_results`+`sites.healthStatus` | Grafana datasource PG read-only (D2.2 — pragmatique) | Stack Prometheus exporter différé Track E.4 |
| **Probes liveness/readiness** | `GET /api/health` (Track E.2 Pass 2) | Grafana panel HTTP Infinity + smoke-prod.sh | 200 ok / 503 degraded (DB+Redis+MinIO) |
| **Notifications événementielles** | `MonitorProcessor` → `NotificationEmitter` | Email channel via Nodemailer (D2.1) + Teams optionnel | `MONITOR_DOWN` / `MONITOR_UP` event types |
| **Syslog** | host `xch-deploy` → `journalctl -u docker -u xch-*` | Local-only J1 (D2.4) | Pas de SIEM externe — réévaluer post-prod |

---

## 2. Probe `/api/health` (Track E.2 Pass 2)

Endpoint canonique pour Kubernetes liveness/readiness, Docker healthchecks, ops scripts.

**Contrat** :

```http
GET /api/health
```

Réponse 200 (toutes dépendances joignables) :

```json
{
  "status": "ok",
  "db": "up",
  "redis": "up",
  "minio": "up",
  "uptime_s": 12345,
  "version": "v2.3.3",
  "checkedAt": "2026-05-16T11:00:00.000Z",
  "details": {
    "db": { "status": "up", "latencyMs": 4 },
    "redis": { "status": "up", "latencyMs": 1 },
    "minio": { "status": "up", "latencyMs": 12 }
  }
}
```

Réponse 503 (au moins une dépendance KO) — même schéma JSON, `status: "degraded"`, le composant fautif a `status: "down"` + `error: <message>`.

**Timeout par probe** : 3s (fail-soft individuel — un MinIO lent n'empêche pas de répondre).

**Auth** : `@Public()` (Kubernetes/Docker n'envoient pas de cookie JWT) + `@SkipDelegation()` (probe infra, pas de scope tenant — catégorie 1 ADR-028).

**Smoke** :

```bash
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .
```

---

## 3. Monitoring : Grafana SQL panels (D2.2)

Décision RSI : **réutiliser l'instance Grafana existante sur `xch-deploy` (host:3000)** plutôt que déployer une stack Prometheus + scraper séparée. Justification : volume métriques actuel (~quelques milliers de `monitor_results` par jour) ne justifie pas le coût d'un exporter — un datasource PostgreSQL en read-only suffit. Stack Prometheus différée Track E.4 si scaling multi-tenant l'exige.

### 3.1 Datasource PostgreSQL read-only

**Étape 1 — créer un utilisateur PG read-only** (à exécuter une fois sur la prod) :

```sql
-- Connexion en superuser PostgreSQL (xch_user ou postgres)
CREATE USER xch_grafana_ro WITH PASSWORD '<XCH_GRAFANA_RO_PASS>';
GRANT CONNECT ON DATABASE xch_dev TO xch_grafana_ro;
GRANT USAGE ON SCHEMA public TO xch_grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO xch_grafana_ro;
-- Pour les tables créées plus tard (futures migrations) :
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO xch_grafana_ro;
```

**Étape 2 — ajouter le datasource dans Grafana** (`<GRAFANA_HOST>:3000` → Settings → Data sources → Add → PostgreSQL) :

| Champ | Valeur |
|---|---|
| Name | `xch-postgres-ro` |
| Host | `xch-postgres:5432` (ou IP interne) |
| Database | `xch_dev` |
| User | `xch_grafana_ro` |
| Password | `<XCH_GRAFANA_RO_PASS>` |
| TLS/SSL Mode | `disable` (réseau Docker interne) |
| PostgreSQL version | 15+ |

→ Test connection : doit afficher « Database Connection OK ».

### 3.2 4 panels SQL — dashboard ops XCH

Créer un nouveau dashboard `XCH Ops` avec 4 panels. PostgreSQL identifie les colonnes en camelCase (Prisma quoted identifiers) — toutes les références utilisent `"<colonne>"`.

#### Panel 1 — Uptime % 24h par check (Stat panel, agrégat global)

```sql
SELECT
  COALESCE(SUM(CASE WHEN status = 'UP'    THEN 1 ELSE 0 END)::float
         / NULLIF(COUNT(*), 0) * 100, 0) AS uptime_pct
FROM monitor_results
WHERE "checkedAt" > NOW() - INTERVAL '24 hours';
```

→ Visualisation : Stat unit = `percent (0-100)`, thresholds `red < 95`, `orange < 99`, `green ≥ 99`.

#### Panel 2 — Failed checks dernière 1h (Table)

```sql
SELECT
  c."tenantId"     AS tenant,
  c.kind           AS kind,
  c.target         AS target,
  c.severity       AS severity,
  r.status         AS status,
  r."responseMs"   AS response_ms,
  r."checkedAt"    AS checked_at,
  r.error          AS error
FROM monitor_results r
JOIN monitor_checks c ON c.id = r."checkId"
WHERE r.status = 'DOWN'
  AND r."checkedAt" > NOW() - INTERVAL '1 hour'
ORDER BY r."checkedAt" DESC
LIMIT 100;
```

→ Visualisation : Table, colored row pour severity = `CRITICAL`.

#### Panel 3 — Répartition `sites.healthStatus` (Pie chart)

```sql
SELECT
  "healthStatus" AS status,
  COUNT(*)       AS sites_count
FROM sites
GROUP BY "healthStatus"
ORDER BY 1;
```

→ Visualisation : Pie chart, color mapping `HEALTHY=green`, `WARNING=orange`, `CRITICAL=red`, `UNKNOWN=gray`.

#### Panel 4 — `/api/health` probe (HTTP Infinity plugin, polling 60s)

> Nécessite le plugin `yesoreyeram-infinity-datasource` (installable depuis Grafana UI > Plugins).

| Champ | Valeur |
|---|---|
| URL | `https://<DEPLOY_DOMAIN>/api/health` |
| Format | JSON |
| Parser | Backend |
| Auth | None |
| Polling | 60s |
| Columns | `$.status`, `$.db`, `$.redis`, `$.minio`, `$.uptime_s` |

→ Visualisation : Stat panel multi-valeur, ou Table 1-ligne avec icons colorés.

---

## 4. SMTP D2.1 — Validation end-to-end via Mailpit

Décision RSI : **valider le pipeline Nodemailer + `NotificationEventType.MONITOR_DOWN/UP` via Mailpit self-hosted** (mock SMTP UI-able). Le relais Postfix interne employeur (`<SMTP_RELAY>`) n'est pas disponible sur `xch-deploy` (dev pilote RSI) — sa validation réelle est différée à Track E.3 cutover prod employeur.

### 4.1 Pourquoi Mailpit ?

- Validation end-to-end **complète** (Nodemailer → SMTP → réception réelle, pas console-log mode).
- Capture emails formatés avec UI web (port 8025) pour audit visuel + extraction body redacté.
- Zéro dépendance externe / auth / SPF.
- Réutilisable Track E.3 comme template de canal de test (différents clients / différents relais).

### 4.2 Procédure smoke (~7 étapes)

```bash
# 1. Démarrer Mailpit (5 sec)
ssh xch-deploy "docker run -d --rm \
  --name xch-mailpit \
  --network xch-network \
  -p 8025:8025 -p 1025:1025 \
  axllent/mailpit:latest"

# 2. Snapshot .env actuel (pour rollback)
ssh xch-deploy "cp /opt/<DEPLOY_DIR>/backend/.env /tmp/backend.env.bak"

# 3. Configurer SMTP vers Mailpit
ssh xch-deploy "cd /opt/<DEPLOY_DIR> && cat >> backend/.env <<EOF
# Track E.2 Pass 4 — SMTP smoke via Mailpit (revert au teardown)
SMTP_HOST=xch-mailpit
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=noreply@<DEPLOY_DOMAIN>
EOF
docker compose restart backend backend-worker"

# 4. Seeder un check monitoring vers cible inatteignable (RFC 5737 doc-only)
#    via UI Sites > <SACRIFICIAL_SITE> > Monitoring > Add HTTP check :
#    URL = http://192.0.2.1:9999
#    Interval = 60s
#    Severity = CRITICAL
#    Notifications : Email <ADMIN_EMAIL>

# 5. Attendre 1-2 min — MonitorProcessor exécute le check, status DOWN
#    Vérifier Mailpit UI : http://<GRAFANA_HOST>:8025
#    -> 1 email MONITOR_DOWN reçu, capturer screenshot

# 6. Re-cibler le check vers http://localhost:3000 (UP)
#    Attendre ~1 min, vérifier 1 email MONITOR_UP recovery

# 7. Teardown
ssh xch-deploy "docker rm -f xch-mailpit && mv /tmp/backend.env.bak /opt/<DEPLOY_DIR>/backend/.env && docker compose restart backend backend-worker"
```

### 4.3 Vérifications attendues

- ✅ Email capturé dans Mailpit UI via le endpoint admin `POST /api/notifications/test` (RBAC `@RequireManage()`).
- ✅ Subject `[XCH] Test de notification` (template `EmailChannel.test()`) — pipeline identique à `EmailChannel.send()` utilisé pour `MONITOR_DOWN/UP`.
- ✅ From / To respectés (`SMTP_FROM` env var, recipient passé en payload).
- ✅ Pour une validation `MONITOR_DOWN` réelle, seeder un check inatteignable via UI Sites > Monitoring (2-min wait) — même `EmailChannel.send()` code path.
- ✅ Body redacté : pas de PII (passwordHash, token, etc.) — la `SECRET_REGEX_BUNDLE` du scrubber GlitchTip est ré-importée par les DTO anti-leak tests (S9 PR #15).

### 4.4 Capture Mailpit Track E.2 Pass 4 (2026-05-16)

Résultat empirique sur `xch-deploy` :

```json
{
  "total": 1,
  "messages": [{
    "From": { "Address": "noreply@xch.eoncom.io" },
    "To":   [{ "Address": "alerts-test@demo.fr" }],
    "Subject": "[XCH] Test de notification",
    "Created": "2026-05-16T10:06:38.224Z",
    "Size": 1171,
    "Snippet": "✅ Test de notification XCH Ce message confirme que la configuration email est fonctionnelle. Envoyé depuis XCH Notification System"
  }]
}
```

→ Pipeline validé : login admin → `POST /api/notifications/test {kind:EMAIL,recipients:[...]}` → `NotificationService.testChannel` → `EmailChannel.test()` → Nodemailer → SMTP 1025 → Mailpit → API REST capture.

### 4.4 Real-SMTP test prod employeur (différé Track E.3)

Procédure pré-flight à exécuter post-cutover air-gap, **dès que `<SMTP_RELAY>` est disponible côté IT employeur** :

```bash
# Test SMTP sortant (utiliser swaks, pas curl — swaks gère DSN+SPF)
ssh <DEPLOY_HOST> "swaks \
  --to <ADMIN_EMAIL> \
  --from noreply@<DEPLOY_DOMAIN> \
  --server <SMTP_RELAY> \
  --port 587 \
  --auth-user <SMTP_USER> \
  --auth-password <SMTP_PASS> \
  --header 'Subject: XCH SMTP smoke test (Track E.3)' \
  --body 'XCH installation completed. Reply OK if received.'"
```

→ Si l'email arrive, configurer `.env` prod + répéter la procédure Mailpit de §4.2 avec le vrai relais.

---

## 5. Notifications event-driven existantes

XCH expose les `NotificationEventType` suivants (cf. [backend/src/modules/notifications/notification-events.ts](../../backend/src/modules/notifications/notification-events.ts)) :

| Event | Trigger | Canal recommandé |
|---|---|---|
| `MONITOR_DOWN` | `MonitorProcessor` détecte une transition `UP → DOWN` | Email + Teams (selon `NotificationConfig` par tenant) |
| `MONITOR_UP` | Transition `DOWN → UP` | Email |
| `TASK_ASSIGNED` | `TasksService.assign` | Email |
| `SITE_STATUS_CHANGED` | `SitesService.updateStatus` | Email |
| `ASSET_CRITICAL` | `AssetsService` ou `MonitorProcessor` (asset-bound check) | Email + Teams |
| `BACKUP_COMPLETED` (Track E.4 backlog) | `BackupProcessor.@OnQueueCompleted` | Email |
| `USER_INVITED`, `PASSWORD_RESET` | `UsersService` / `AuthService` | Email |

**Routing** : `NotificationConfigService` (post-S3 refactor) résout `(tenantId, delegationId?, eventType)` → `NotificationRule[]` → `NotificationChannel[]`. Voir `XCH_PRISMA_MODELING_RULES` MCP entity pour les `@@unique` partial indexes.

---

## 6. Syslog local J1 (D2.4)

Pas de SIEM en production initiale (`<DEPLOY_HOST>` air-gap, pas de canal sortant pour drain Splunk/ELK).

**Sources de logs disponibles** :

```bash
# Containers XCH
docker logs xch-backend --since 1h --follow
docker logs xch-backend-worker --since 1h --follow
docker logs xch-frontend --since 1h --follow

# Stack GlitchTip (si actif)
docker logs glitchtip-web --since 1h
docker logs glitchtip-worker --since 1h

# Système
journalctl -u docker --since '1 hour ago'
journalctl --since '1 hour ago' --priority=err
```

**Rotation** : Docker daemon par défaut (10MB × 3 fichiers par container). Configurable via `/etc/docker/daemon.json` :

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" }
}
```

→ Réévaluer post-prod selon volume et besoins audit (Track E.4 ou Track F).

---

## 7. Cross-références

- Health endpoint code : [backend/src/modules/health/health.controller.ts](../../backend/src/modules/health/health.controller.ts)
- Smoke prod : [scripts/smoke-prod.sh](../../scripts/smoke-prod.sh) (6/6 endpoints)
- GlitchTip ADR : [docs/decisions/adr-024-glitchtip-air-gap-observability.md](../decisions/adr-024-glitchtip-air-gap-observability.md)
- Monitoring unification ADR : [docs/decisions/adr-016-monitoring-unification.md](../decisions/adr-016-monitoring-unification.md)
- Health aggregation ADR : [docs/decisions/adr-022-health-aggregation-semantics.md](../decisions/adr-022-health-aggregation-semantics.md)
- Audit V1 canal sortant : [docs/audit/track-e2-glitchtip-state.md](../audit/track-e2-glitchtip-state.md)
- Plan Track E parent : MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15` (D2.1-D2.4 décisions opérationnelles)
