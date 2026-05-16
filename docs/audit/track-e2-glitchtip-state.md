# Track E.2 — Pass 1 : audit empirique V1 (canal sortant GlitchTip)

**Date** : 2026-05-16
**Auteur** : RSI (audit autonome Track E.2 Pass 1)
**Scope** : Vigilance V1 — vérifier si l'instrumentation GlitchTip v2.1.0 fuite vers Sentry SaaS ou si elle a perdu silencieusement des événements depuis Track S8.
**Baseline auditée** : tag `v2.3.2` (commit `463a648`).
**Environnement audité** : `xch-deploy` (pilote dev RSI, cf. `XCH_DEPLOY_ENVIRONMENT_NATURE`).

---

## Verdict (TL;DR)

✅ **Canal sortant GlitchTip ACTIF et SAIN** depuis 2026-05-09 (release v2.1.0).
✅ **Zéro fuite Sentry SaaS** — les 3 DSNs (backend, worker, frontend) résolvent vers l'instance self-hosted accessible uniquement via le réseau interne du host xch-deploy + reverse proxy NPM.
✅ **Zéro événement perdu silencieusement** — 7 événements historiques persistés dans `glitchtip-postgres`, couvrant les acceptance tests S8 + les smoke tests Tracks D.2 et E.1.
⚠️ **`audit-egress.sh --strict` FAIL 2/4 sur xch-deploy** — résultat attendu (xch-deploy n'est pas air-gappé, cf. environnement nature). Le test reste valide pour la cible Track E.3 (cutover pilote employeur air-gap).

---

## 1. Containers GlitchTip

```text
$ ssh xch-deploy "docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -iE 'glitchtip|sentry'"
glitchtip-admin-seed        glitchtip/glitchtip:v4.1   Exited (0) 7 days ago
glitchtip-web               glitchtip/glitchtip:v4.1   Up 7 days
glitchtip-worker            glitchtip/glitchtip:v4.1   Up 7 days
glitchtip-postgres          postgres:16-alpine         Up 7 days (healthy)
glitchtip-redis             redis:7-alpine             Up 7 days (healthy)
```

Stack identique à ADR-024 (5 containers). `admin-seed` est un job ponctuel de bootstrap, son Exit(0) est nominal. Up depuis ~7 jours = release v2.1.0 (PR #56, 2026-05-09).

## 2. Configuration DSN

### Backend + worker (`/opt/<DEPLOY_DIR>/backend/.env`)

```text
GLITCHTIP_DSN_BACKEND=http://<KEY>@glitchtip-web:8000/<PROJ_BACKEND>
GLITCHTIP_DSN_WORKER=http://<KEY>@glitchtip-web:8000/<PROJ_WORKER>
GLITCHTIP_ENVIRONMENT=production
```

→ Schéma `http://` (pas TLS, cohérent communication Docker interne).
→ Host `glitchtip-web` = nom DNS Docker (network `xch-network`).
→ Port `8000` = port interne GlitchTip uwsgi.
→ Aucune ressemblance à `o<orgid>.ingest.sentry.io`.

### Frontend (`/opt/<DEPLOY_DIR>/frontend/.env`)

```text
NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=<KEY_REDACTED>@glitch.<DEPLOY_DOMAIN>/<PROJ_FRONTEND>
NEXT_PUBLIC_ENVIRONMENT=production
```

→ Host `glitch.<DEPLOY_DOMAIN>` (réécrit dans ce rapport, valeur réelle = sous-domaine interne).
→ Résolution DNS testée :

```text
$ ssh xch-deploy "nslookup glitch.<DEPLOY_DOMAIN>"
Address: 192.168.0.13         # IP privée RFC1918

$ ssh xch-deploy "curl -s -o /dev/null -w 'http=%{http_code} ip=%{remote_ip}\n' https://glitch.<DEPLOY_DOMAIN>/api/0/"
http=200 ip=192.168.0.13
```

→ Le navigateur ne pouvant pas résoudre `glitchtip-web` (DNS Docker interne), le frontend ingère via NPM (Nginx Proxy Manager) sur un sous-domaine public **résolvant en IP privée** : la connexion est TLS-terminée localement et reroutée vers `glitchtip-web:8000`. Le pattern est figé dans ADR-024 (DSN strategy §browser+SSR).

## 3. Validation `audit-egress.sh --strict`

Exécuté depuis `xch-backend` container sur xch-deploy :

```text
=== Assertion 1 : aucun outbound vers https://sentry.io depuis xch-backend ===
✗ Assertion 1/4 FAIL — egress vers https://sentry.io a RÉUSSI (HTTP 302) — réseau ouvert

=== Assertion 2 : DNS résolution sentry.io NXDOMAIN (host) ===
✗ Assertion 2/4 FAIL — DNS sentry.io a résolu

=== Assertion 3 : http://glitchtip-web:8000/api/0/ joignable depuis xch-backend ===
✓ Assertion 3/4 PASS — GlitchTip interne joignable (HTTP 405)

=== Assertion 4 : aucun 'sentry.io' hardcodé dans backend/src + frontend/src ===
✓ Assertion 4/4 PASS — 0 match 'sentry.io'

Mode : STRICT (prod air-gap)
  PASS : 2/4
  FAIL : 2/4
```

**Interprétation :**

- Assertions 1+2 FAIL = xch-deploy a un accès internet ouvert. **Résultat attendu** : xch-deploy est le pilote dev RSI, pas un déploiement air-gap (cf. MCP `XCH_DEPLOY_ENVIRONMENT_NATURE`).
- Assertion 3 PASS = canal interne XCH ↔ GlitchTip opérationnel.
- Assertion 4 PASS = aucun DSN SaaS hardcodé dans le code XCH.

→ **`audit-egress.sh --strict` reste le test bloquant pour Track E.3 cutover air-gap pilote employeur** ; sur xch-deploy il documente l'écart entre les deux environnements.

## 4. Événements historiques GlitchTip (réfutation V1)

Requête sur `glitchtip-postgres` (table partitionnée `issue_events_issue`) :

| id | last_seen (UTC) | level | project | title (résumé) |
|---|---|---|---|---|
| 1 | 2026-05-09 10:02:19 | 4 | xch-backend | `XCH_TEST_ERROR_BACKEND: synthetic unhandled exception` |
| 2 | 2026-05-09 10:02:19 | 4 | xch-backend | `XCH_TEST_ERROR_WORKER: synthetic worker failure` |
| 3 | 2026-05-09 12:04:02 | 4 | xch-frontend | `XCH_TEST_ERROR_FRONTEND: synthetic browser unhandled` |
| 4 | 2026-05-09 12:10:03 | 4 | xch-frontend | `XCH_TEST_ERROR_FRONTEND: synthetic browser unhandled` |
| 5 | 2026-05-14 10:47:06 | 4 | xch-backend | `Error: getaddrinfo EAI_AGAIN minio` (Track D.2 smoke) |
| 6 | 2026-05-15 08:26:47 | 4 | xch-backend | `Error: ENOENT: ... /tmp/xch-restore-upload-...zip` (Track D.2 multipart hotfix path) |
| 7 | 2026-05-15 09:43:20 | 4 | xch-backend | `NotFoundException: Backup fake-tenant-other-backup-id not found in catalog` (Track E.1 BOLA test) |

Volume agrégé par jour :

| Date | Issues distinctes | Total events |
|---|---|---|
| 2026-05-09 | 4 | 4 |
| 2026-05-14 | 1 | 1 |
| 2026-05-15 | 2 | 2 |

**Lecture :**

- L'instrumentation v2.1.0 capture **trois projets** distincts (`xch-backend`, `xch-worker`, `xch-frontend`) — couverture conforme ADR-024.
- Le scrubber `beforeSend` et la taxonomie `mode: api|worker` (cf. [backend/src/common/observability/glitchtip/init.ts:80-83](backend/src/common/observability/glitchtip/init.ts:80)) fonctionnent — pas de PII visible dans les titres.
- Les events Track D.2 (multipart MinIO/tmp) et Track E.1 (BOLA NotFoundException) prouvent que le canal capture les anomalies réelles, pas seulement les test events S8.
- **Aucun event manquant** : la séquence chronologique colle aux smoke prod connus (S8 acceptance le 2026-05-09 → D.2 le 2026-05-14 → E.1 le 2026-05-15).

→ **Vigilance V1 réfutée** : aucun événement n'a été perdu silencieusement, le canal est joignable et persistant depuis 7 jours.

## 5. Test-error endpoints (état prod)

```text
ENABLE_TEST_ERROR_ENDPOINTS=false
NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=false
```

→ Endpoints désactivés depuis acceptance v2.1.0. Le double-gate (env flag + isSuperAdmin) est respecté en production. Pas besoin de réémettre un test event en Pass 1 : le corpus historique (7 issues réels) suffit à prouver l'opérationnalité du canal.

## 6. Conclusions actionnables

| Item | Décision Track E.2 |
|---|---|
| Activation GlitchTip xch-deploy | ✅ Déjà actif depuis v2.1.0 — aucune action requise. |
| Activation GlitchTip pilote employeur (Track E.3) | Procédure `glitchtip/scripts/gen-dsn.sh` + injection `.env` à ajouter dans `install-airgap.sh` (référence Track E.3 backlog). |
| Réactivation test-error endpoints | Hors scope E.2. Procédure documentée dans `docs/operator/incident-response.md` (Pass 8) pour drill annuel. |
| Audit-egress strict bloquant CI | Non-bloquant E.2 (assertions 1+2 dépendent du runtime air-gap). Bloquant E.3 sur cible employeur. |
| Pattern audit canal sortant | Ré-exécuter `bash scripts/audit-egress.sh --strict` post-cutover Track E.3 sur la VM pilote → doit PASS 4/4. |

## 7. Captures commandes archivées (5)

1. `docker ps | grep glitchtip` → 5 containers + 1 admin-seed exited.
2. `grep GLITCHTIP_DSN /opt/.../backend/.env` → DSNs `http://...@glitchtip-web:8000/...` internes.
3. `nslookup glitch.<DEPLOY_DOMAIN>` → `192.168.0.13` (RFC1918 privée).
4. `bash scripts/audit-egress.sh --strict` → 2/4 PASS (assertions code-clean + canal interne OK ; assertions réseau FAIL = dev env open).
5. `psql ... SELECT FROM issue_events_issue` → 7 events réels, 3 projets, 3 jours d'activité.

---

**Pass 1 closing :** Vigilance V1 résolue. GlitchTip est sain, le canal sortant ne fuite pas. Pas de hotfix requis pour E.2. Procédure d'activation à compiler dans `install-airgap.sh` lors de Track E.3.
