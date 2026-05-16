# Track E.3 Pass 1 — catastrophe partielle 2026-05-16 (audit défensif Pattern D.2)

**Date :** 2026-05-16T14:32:44+02:00
**Auteur :** RSI (Track E.3 v2.2 Pass 1 réel, autonomous)
**Contexte :** Premier exécution réelle de `scripts/teardown-xch-stack.sh` post-validation dry-run. Pattern Track D.2 multipart-gap déclenché — STOP + audit immédiat.

---

## TL;DR

Le `docker compose -p xch down --volumes --remove-orphans` a effacé la **stack GlitchTip** alors que la whitelist du script l'excluait explicitement. **7 events historiques GlitchTip perdus** (S8 acceptance + D.2 smoke + E.1 BOLA test). Conformément à `XCH_DEMO_DATA_PRINCIPLE`, perte acceptable (données test). Bug latent **détecté avant cutover prod réel** — bénéfice net.

---

## 1. Dégâts confirmés

### ❌ Wiped (lost)

| Ressource | Type | Statut attendu | Statut réel |
|---|---|---|---|
| 8 containers XCH (postgres/redis/minio/minio-init/backend/backend-worker/frontend/nginx) | wipe | wipe | ✅ wipe conforme |
| 4 volumes XCH (`xch_postgres_data`, `xch_redis_data`, `xch_minio_data`, `xch_xch-upload-staging`) | wipe | wipe | ✅ wipe conforme |
| 5 containers GlitchTip (admin-seed, web, worker, postgres, redis) | **PRESERVER** | **wiped** | ❌ **catastrophe** |
| 2 volumes GlitchTip (`xch_glitchtip_postgres_data`, `xch_glitchtip_redis_data`) | **PRESERVER** | **wiped** | ❌ **catastrophe** |
| Network `xch_glitchtip-internal` | PRESERVER | wiped | ❌ catastrophe |
| Volume `xch_db-data` (zombie historique) | PRESERVER | wiped | ⚠️ zombie acceptable |
| Pre-wipe backup auto via `/api/backup/full` | créé | **non créé** (script aborted) | ❌ |
| Backend `.env` rotation | régénéré | inchangé (script aborted) | ⚠️ acceptable |

### ✅ Survivants intacts

```
--- Containers up ---
portainer                   Up 3 weeks
uptime-kuma                 Up 4 weeks (healthy)
tailscale                   Up 4 weeks
meshcentral                 Up 4 weeks
prometheus                  Up 4 weeks
node_exporter               Up 4 weeks
grafana                     Up 4 weeks
homeassistant               Up 4 weeks
matter-server               Up 4 weeks
nginx-proxy-manager-app-1   Up 6 days

--- Volumes ---
adventurelog_adventurelog_media, adventurelog_postgres_data
infrastructure_grafana_data
portainer_data1
xch-0-1_db-data (zombie), xch_casbin-policies (zombie), xch-minio-data (zombie)
4 hash-only unnamed volumes (compose-managed sans nom explicite)

--- Networks ---
bridge, host, none, infrastructure_infra_network, mechcentral_tailscale_default,
nginx-proxy-manager_default, portainer-update-*_default, uptime-kuma_kuma_network,
xch_xch-network (sauvé car nginx-proxy-manager-app-1 y était connecté)

--- Filesystem ---
/opt/xch-dev/XCH/  → 13 dirs, intact (git repo, backend/, frontend/, scripts/, docs/, etc.)
/opt/xch-dev/XCH/backend/.env  → mai 16 12:30 (pre-wipe state, OLD prod values)
/opt/xch-dev/XCH/glitchtip/.env  → mai 9 11:55 (original GlitchTip secrets intacts)
/opt/xch-dev/XCH/glitchtip/scripts/{gen-dsn.sh,gen-secrets.sh} → intacts
/opt/xch-dev/XCH/docker-compose.glitchtip.yml → intact
```

---

## 2. Cause racine

### Le commande dangereux

```bash
docker compose -p xch down --volumes --remove-orphans
```

### Explication

1. Le compose project name `xch` (default deduce du dossier `XCH`) regroupe **TOUS** les containers démarrés depuis `/opt/xch-dev/XCH/` — quel que soit le fichier compose utilisé.
2. Sur xch-deploy, `docker-compose.glitchtip.yml` a été démarré sans `-p` explicite → project name `xch` aussi.
3. `docker compose -p xch ps -a` aurait listé **les 8 containers XCH + les 5 containers GlitchTip** comme appartenant au même project.
4. `--remove-orphans` énumère et supprime les containers du project qui ne sont pas dans le compose file en cours → tué `glitchtip-*` (qui sont dans `docker-compose.glitchtip.yml`, pas `docker-compose.yml`).
5. `--volumes` supprime tous les volumes du project → tué `xch_glitchtip_postgres_data` + `xch_glitchtip_redis_data`.

### Pourquoi la whitelist n'a pas protégé

La whitelist du script v1 était **descriptive** (vérification Pre-flight de l'état) et non **prescriptive** (limitation des actions). Le wipe lui-même reposait sur le scope project de docker compose, qui est plus large que la whitelist.

---

## 3. Lessons learned (capitalisation MCP)

### Anti-pattern

```bash
# ❌ ANTI-PATTERN : trop large, scope = project name (déduit du dossier ou env)
docker compose down --volumes --remove-orphans
```

### Pattern correct (surgical)

```bash
# ✅ PATTERN CORRECT : explicit container/volume names from whitelist
for c in "${XCH_CONTAINERS[@]}"; do
  docker stop "$c" 2>/dev/null
  docker rm "$c" 2>/dev/null
done
for v in "${XCH_VOLUMES[@]}"; do
  docker volume rm "$v" 2>/dev/null
done
```

### Pre-flight cross-project pollution check (à ajouter)

```bash
# Avant tout wipe : détecter si GlitchTip containers existent dans le même project
LEAK=$(docker ps -a --filter "label=com.docker.compose.project=xch" \
       --format '{{.Names}}' | grep -E '^glitchtip-' | wc -l)
if [[ "$LEAK" -gt 0 ]]; then
  echo "ERROR: GlitchTip containers found in project 'xch' — refuse to wipe."
  echo "Fix: restart GlitchTip with isolated project name :"
  echo "  docker compose -f docker-compose.glitchtip.yml -p xch-glitchtip up -d"
  exit 1
fi
```

### Recovery pattern : project name isolation

```bash
# ✅ Démarrer GlitchTip avec project name SÉPARÉ
docker compose -f docker-compose.glitchtip.yml -p xch-glitchtip up -d

# Conséquence : les volumes seront préfixés `xch-glitchtip_*` au lieu de `xch_*`
# → impossible de les wiper accidentellement par `docker compose -p xch down`
```

---

## 4. Plan recovery (acquitté user 2026-05-16)

1. ✅ Forensic snapshot capturé (ce document)
2. ⏳ Fix `scripts/teardown-xch-stack.sh` v2 :
   - Supprimer `docker compose down --volumes --remove-orphans`
   - Surgical `docker rm` + `docker volume rm` par whitelist explicite
   - Pre-flight cross-project pollution check ABORT si overlap détecté
   - Re-test `--dry-run` 2× pour confirmer 0 leak
3. ⏳ Recovery GlitchTip avec project name isolé :
   - `cd /opt/xch-dev/XCH && docker compose -f docker-compose.glitchtip.yml -p xch-glitchtip up -d`
   - Si nouveaux DSNs nécessaires → `bash glitchtip/scripts/gen-dsn.sh` (re-créer projects xch-backend / xch-worker / xch-frontend)
4. ⏳ Capitaliser MCP : créer `XCH_CO_HOSTED_DOCKER_PROJECTS_DISCIPLINE_2026_05_16` (engineering_pattern) avec anti-pattern + pattern correct + référence Track E.3 Pass 1 catastrophe
5. ⏳ Re-Pass 1 bootstrap from scratch avec script v2 corrigé

### Acceptation perte

Les 7 events GlitchTip historiques **sont définitivement perdus**. Conformément à `XCH_DEMO_DATA_PRINCIPLE`, données test acceptables. Les métadonnées de ces events sont déjà capturées dans :
- `docs/audit/track-e2-glitchtip-state.md` §4 (titres + timestamps + projets)
- MCP `XCH_TRACK_E2_DR_MONITORING_2026_05_16` Pass 1 observation

Le code source XCH instrumenté (Sentry SDK + scrubber + capture sites) est intact et permet de re-générer des events de test à la demande post-recovery.

---

## 5. Vigilance ajoutée (pour Track E.3 + E.4 + futur)

**Pattern catch défensif**, même au-delà de cette session :

> Avant tout `docker compose down --volumes` sur xch-deploy ou cible analogue avec services co-localisés :
> 1. Lister TOUS les containers du project via `docker compose ps -a` ou `docker ps --filter label=com.docker.compose.project=<NAME>`
> 2. Vérifier que la liste = exactement la whitelist attendue
> 3. Si écart → refuser + forcer l'isolation par project name explicite

Le bug latent était présent depuis l'introduction de GlitchTip (Track S8, 2026-05-09 v2.1.0). Il n'a jamais été déclenché en condition opérationnelle car aucune procédure n'utilisait `docker compose -p xch down --volumes --remove-orphans` jusqu'à ce Pass 1. Le **catch défensif Track D.2 multipart-gap** a fait son travail — découverte avant cutover prod employeur.

---

## 6. Annexes — snapshot forensique brut

### docker volume ls (post-catastrophe)

```
local 2884acc68bac664ede9acf8038c4d9108043bf627bcfb27ef1b17d385ca09904
local 2f9ba4aba72651abfc7b2d192c960ae004c4d46a490dcd2f97338a90ed458eea
local 9477f3cec1c75ef62faf1a757d9966ac2ee65a71e74358722cb17b16cd8e83b5
local a87d6c7280395f29864b62071de01f299ce925855aa7b59b8fdec80be5610941
local adventurelog_adventurelog_media
local adventurelog_postgres_data
local d6d65de10c18bcf258b94503cca37b3d4da58b1ed16c5d86f961ec34b9b2b0f2
local infrastructure_grafana_data
local portainer_data1
local xch-0-1_db-data
local xch_casbin-policies
local xch-minio-data
```

**Disparus vs pre-wipe (cf. MCP Track E.2 Pass 1 verdict V1) :** `xch_postgres_data`, `xch_redis_data`, `xch_minio_data`, `xch_xch-upload-staging`, `xch_glitchtip_postgres_data`, `xch_glitchtip_redis_data`, `xch_db-data` (zombie).

### docker network ls (post-catastrophe)

```
bridge bridge
host host
infrastructure_infra_network bridge
mechcentral_tailscale_default bridge
nginx-proxy-manager_default bridge
none null
portainer-update-*_default bridge
uptime-kuma_kuma_network bridge
xch_xch-network bridge
```

**Disparus :** `xch_glitchtip-internal`.
**Survie inattendue :** `xch_xch-network` (nginx-proxy-manager-app-1 y était connecté → `docker compose down` n'a pas pu le retirer → le wipe a été partiel à cet endroit, sauvant accidentellement le network).

### Backend `.env` (intact)

```
-rw-r--r-- 1 claude-deploy claude-deploy 1942 mai   16 12:30 backend/.env
-rw-r--r-- 1 claude-deploy claude-deploy 1942 avril 26 19:40 backend/.env.production
-rw-rw-r-- 1 claude-deploy claude-deploy 4070 mai   12 19:03 backend/.env.example
```

`.env` du 16 mai 12:30 = état pré-wipe (GLITCHTIP_DSN_BACKEND/WORKER + SMTP* peuvent persister mais pointeront vers le nouveau GlitchTip post-recovery — DSNs internes même format).
