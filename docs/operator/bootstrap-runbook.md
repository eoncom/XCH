# XCH — Bootstrap runbook (air-gap pilote) — Track E.3 Pass 1+2

> **Scope** : procédure pas-à-pas pour bootstrapper XCH depuis zéro sur un host Linux air-gap. Validée empiriquement sur xch-deploy par 2 cycles wipe + bootstrap successifs (Pass 1 + Pass 2 Track E.3).
> **Pré-requis figés** : Docker ≥ 24 + docker compose v2 + `cryptsetup` (offsite) + `openssl` + accès git (mirror local interne en air-gap strict).
> **Placeholders Option C** : `<DEPLOY_DOMAIN>`, `<DEPLOY_HOST>`, `<COMPOSE_DIR>` (par ex. `/opt/<DEPLOY_DIR>`), `<NPM_CONTAINER>`, `<ADMIN_EMAIL>`, `<ADMIN_PASSWORD>`, `<ORG_NAME>`, `<TENANT_SUBDOMAIN>`.

---

## 0. Pré-requis air-gap

| Item | Vérification |
|---|---|
| Docker 24+ | `docker --version` (≥ 24.0) |
| Docker compose v2 | `docker compose version` (≥ v2.20) |
| Disque libre | `df -h /var /opt` (au moins 20 GB libre `/var` pour Docker overlay) |
| Compose dir | `ls <COMPOSE_DIR>/docker-compose.yml` (présent) |
| GlitchTip stack ISOLÉ (cf. `XCH_CO_HOSTED_DOCKER_PROJECTS_DISCIPLINE_2026_05_16`) | `docker volume ls \| grep glitchtip` doit afficher `xch-glitchtip_*` (NOT `xch_*`) |
| NPM proxy (Nginx Proxy Manager) | `<NPM_CONTAINER>` running, route `<DEPLOY_DOMAIN>` → `xch-backend:3000` + `xch-frontend:3001` configurée |
| Cert TLS | NPM gère cert (Let's Encrypt si internet ; CA interne sinon) |
| NTP | `chrony` ou `systemd-timesyncd` sync vers `<NTP_SOURCE>` (voir [cutover-prod-airgap.md §V4](cutover-prod-airgap.md#v4-ntp-fail-fast)) |

---

## 1. Wipe (si retry / cycle de test)

Réserver à : tests de reproductibilité, cycle de récupération post-incident, ou drill annuel.

```bash
# Pre-flight : confirmer pollution check (script v2 ABORT si overlap détecté)
bash <COMPOSE_DIR>/scripts/teardown-xch-stack.sh --dry-run

# Exec réel (auto-confirme avec --yes ; sinon prompt 'WIPE')
RESTORE_ADMIN_EMAIL='<ADMIN_EMAIL>' \
RESTORE_ADMIN_PASSWORD='<ADMIN_PASSWORD>' \
bash <COMPOSE_DIR>/scripts/teardown-xch-stack.sh
```

Le script v2 :
- ABORT si des containers/volumes `glitchtip-*` ou `xch_glitchtip_*` sont taggés avec project `xch` (force isolation via `-p xch-glitchtip` au préalable).
- Pre-wipe backup automatique via `POST /api/backup/full` (sauf `--skip-backup`).
- Surgical `docker stop` + `docker rm` + `docker volume rm` sur la whitelist explicite (jamais `compose down`).
- Garde `xch_xch-network` si des containers hors-XCH y sont attachés (ex. NPM proxy).
- Rotation `.env` → `.env.bak.<TS>` puis `cp .env.example .env`.
- Validation post-wipe : 4/4 GlitchTip sentinels running + Grafana host:3000 ≠ 5xx.

---

## 2. Génération des secrets (.env)

Sur la VM cible :

```bash
cd <COMPOSE_DIR>

# Génération secrets sécurisés via /dev/urandom + base64
JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 64)
JWT_REFRESH=$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 64)
PG_PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
MINIO_KEY=$(head -c 16 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
MINIO_SECRET=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
REDIS_PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
MASTER_KEY=$(openssl rand -base64 32)

# Backend env (NestJS)
cat > backend/.env <<EOF
DATABASE_URL="postgresql://xch_user:${PG_PASS}@postgres:5432/xch_dev"
NODE_ENV=production
PORT=3000

JWT_SECRET="${JWT_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH}"
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

COOKIE_SECURE=true
COOKIE_DOMAIN=<DEPLOY_DOMAIN>
FRONTEND_URL=https://<DEPLOY_DOMAIN>

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=${MINIO_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET}
MINIO_BUCKET=xch-storage

STORAGE_TYPE=minio
UPLOAD_DIR=./uploads

XCH_MASTER_KEY=${MASTER_KEY}

# GlitchTip DSNs — voir §3 ci-dessous pour les obtenir
GLITCHTIP_DSN_BACKEND=
GLITCHTIP_DSN_WORKER=
GLITCHTIP_ENVIRONMENT=production

ENABLE_TEST_ERROR_ENDPOINTS=false
EOF

# Root env (docker-compose substitution)
cat > .env <<EOF
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=xch_dev
REDIS_PASSWORD=${REDIS_PASS}
MINIO_ACCESS_KEY=${MINIO_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET}
HTTP_PORT=80
HTTPS_PORT=443

NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=
NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT=production
NEXT_PUBLIC_GLITCHTIP_RELEASE=
NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=false
EOF

chmod 600 backend/.env .env
echo "Secrets generated. Records the values in your secret vault (split-knowledge or sealed envelope)."
```

> ⚠️ **Stocker les secrets** dans le vault opérateur AVANT de continuer (per [secrets-rotation.md](secrets-rotation.md) §key escrow).

---

## 3. GlitchTip DSNs (régénérer si stack recovery)

Si GlitchTip stack est neuve (post-catastrophe ou cutover initial) :

```bash
# Démarrer GlitchTip avec project name ISOLÉ (jamais `xch` !)
cd <COMPOSE_DIR>
docker compose -f docker-compose.glitchtip.yml -p xch-glitchtip --env-file glitchtip/.env up -d

# Wait migrations + admin-seed (~30-60s)
until docker inspect glitchtip-postgres -f '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; do sleep 3; done

# Générer org + 3 projects (xch-backend / xch-worker / xch-frontend)
bash glitchtip/scripts/gen-dsn.sh
# → outputs JSON with the 3 DSNs to inject in .env files
```

Injecter les 3 DSNs dans :
- `backend/.env` : `GLITCHTIP_DSN_BACKEND` + `GLITCHTIP_DSN_WORKER`
- `.env` (root) : `NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND`

---

## 4. Démarrer le stack XCH

```bash
cd <COMPOSE_DIR>
docker compose up -d

# Attendre healthchecks (postgres + redis + minio + backend + worker + frontend)
until \
  docker inspect xch-postgres -f '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy && \
  docker inspect xch-redis -f '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy && \
  docker inspect xch-minio -f '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy && \
  docker inspect xch-backend -f '{{.State.Status}}' 2>/dev/null | grep -q running && \
  docker inspect xch-frontend -f '{{.State.Status}}' 2>/dev/null | grep -q running; do
  sleep 5
done
echo "All XCH containers healthy"
```

Le `docker-entrypoint.sh` du backend exécute :
1. `prisma generate`
2. `prisma db push` + `post-push.sql` (CHECK constraints) — équivalent en prod : `prisma migrate deploy` (ADR-017)
3. `node dist/main`

---

## 5. ⚠️ NPM proxy DNS cache (gotcha critique)

**Symptôme post-bootstrap** : `curl https://<DEPLOY_DOMAIN>/api/health` retourne `502 Bad Gateway openresty`.

**Cause** : NPM (Nginx Proxy Manager) cache l'IP du container `xch-backend` au démarrage initial. Après `docker compose up -d --force-recreate` ou wipe + restart, le container reçoit une nouvelle IP, mais NPM continue de pointer vers l'ancienne. Documenté MCP `DEPLOY_WORKFLOW`.

**Fix obligatoire post-bootstrap** :

```bash
docker exec <NPM_CONTAINER> sh -c 'nginx -s reload'
# Confirmer recovery (3 sec)
sleep 3
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .status
# attendu : "ok"
```

> Ajouter ce step à **chaque** cycle wipe + bootstrap. Pas optionnel.

---

## 6. Smoke 6/6 + setup wizard

```bash
# Smoke test post-bootstrap
bash <COMPOSE_DIR>/scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
# Attendu : ✓ SMOKE PASS — 6/6

# Confirm setup needed (fresh DB)
curl -s https://<DEPLOY_DOMAIN>/api/setup/status | jq .needsSetup
# attendu : true
```

### Option A — Setup wizard via UI (interactif)

1. Naviguer `https://<DEPLOY_DOMAIN>/`
2. Suivre le wizard : organization name + subdomain + admin email + admin password + nom + load demo data
3. Submit → redirection vers le dashboard

### Option B — Setup wizard via API (scripté)

```bash
curl -sS -X POST https://<DEPLOY_DOMAIN>/api/setup/initialize \
  -H 'Content-Type: application/json' \
  -d "{
    \"organizationName\": \"<ORG_NAME>\",
    \"subdomain\": \"<TENANT_SUBDOMAIN>\",
    \"adminEmail\": \"<ADMIN_EMAIL>\",
    \"adminPassword\": \"<ADMIN_PASSWORD>\",
    \"adminName\": \"<ADMIN_NAME>\",
    \"loadDemoData\": false
  }" | jq .
```

Réponse attendue : `{"success": true, "tenant": {...}, "admin": {...}, "demoData": null}`.

> ⚠️ Si `loadDemoData: true` est passé en pilote employeur réel : ATTENTION, les seeds incluent des données de démo (Pilote Demo, sites Boulogne/Saclay, etc.). Préférer `false` en cutover prod employeur.

---

## 7. Validation finale post-bootstrap

```bash
# 1. Smoke 6/6
bash <COMPOSE_DIR>/scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>

# 2. Login admin
curl -s -c /tmp/c.txt -X POST https://<DEPLOY_DOMAIN>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}' \
  -w '\nHTTP=%{http_code}\n'
# attendu : 201 + user JSON

# 3. /api/health all up
curl -s https://<DEPLOY_DOMAIN>/api/health | jq '{status, db, redis, minio}'

# 4. GlitchTip stack alive (DB query)
docker exec glitchtip-postgres psql -U glitchtip -d glitchtip \
  -c "SELECT slug FROM projects_project;"
# attendu : 3 lignes (xch-backend / xch-worker / xch-frontend)

# 5. Audit egress (xch-deploy dev env : assertions 3+4 PASS attendu)
bash <COMPOSE_DIR>/scripts/audit-egress.sh
# pour air-gap pilote employeur : bash audit-egress.sh --strict (attendu 4/4 PASS)
```

---

## 8. Pass 1 retex — gaps identifiés et patchs

Réf empirique sur xch-deploy 2026-05-16 (cf. [track-e3-pass1-catastrophe-2026-05-16.md](../audit/track-e3-pass1-catastrophe-2026-05-16.md) pour le cycle 1 v1).

| # | Gap | Patch appliqué |
|---|---|---|
| 1 | `docker compose down --volumes --remove-orphans` co-hosted catastrophique | Script v2 `teardown-xch-stack.sh` : surgical `docker rm` + `docker volume rm` + pollution check. MCP `XCH_CO_HOSTED_DOCKER_PROJECTS_DISCIPLINE_2026_05_16` figec le pattern. |
| 2 | `install-airgap.sh` attend `images/` directory avec `.tar` files — absent sur xch-deploy (images cachées) | Pour xch-deploy banc de test : sauter Step 1 du script, ou pattern manuel §2 ci-dessus. Pour cutover prod employeur : `images/` doit être package via [package-release.sh](../../scripts/package-release.sh). |
| 3 | NPM proxy DNS cache (502 post-bootstrap) | Step 5 `docker exec <NPM> nginx -s reload` ajouté au runbook. Documenté MCP `DEPLOY_WORKFLOW`. |
| 4 | `gen-dsn.sh` génère des nouveaux DSNs à chaque exec (idempotent : GET existing si présents, CREATE sinon) — confirmé OK | Aucun patch nécessaire ; documenter qu'à chaque cycle wipe les DSNs DOIVENT être ré-injectés dans `.env` (si GlitchTip a aussi été wiped). |
| 5 | `xch_xch-network` survit aux wipes si NPM y est connecté | Script v2 laisse le network en place si attaché par un container externe. Pas de patch nécessaire — bootstrap suivant le réutilise. |

---

## 9. Cross-références

- Wipe script : [scripts/teardown-xch-stack.sh](../../scripts/teardown-xch-stack.sh) (v2 — surgical + pollution check)
- Catastrophe forensic : [docs/audit/track-e3-pass1-catastrophe-2026-05-16.md](../audit/track-e3-pass1-catastrophe-2026-05-16.md)
- Smoke 6/6 : [scripts/smoke-prod.sh](../../scripts/smoke-prod.sh)
- DR drill (backup + restore) : [dr-drill.md](dr-drill.md)
- Recovery scénarios service-down : [recovery-runbook.md](recovery-runbook.md)
- Cutover prod air-gap (V3 SSO LDAP + V4 NTP + offsite) : [cutover-prod-airgap.md](cutover-prod-airgap.md) (Pass 6 + 7 + 8)
- Offsite USB LUKS : [offsite-backup.md](offsite-backup.md)
- Pattern co-hosted Docker discipline : MCP `XCH_CO_HOSTED_DOCKER_PROJECTS_DISCIPLINE_2026_05_16`
- Pattern teardown procedure : MCP `XCH_TEARDOWN_XCH_STACK_PROCEDURE_2026_05_XX` (Pass 10 closure)
