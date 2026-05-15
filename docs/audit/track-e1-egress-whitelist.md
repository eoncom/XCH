# Track E.1 — Egress whitelist générique

**Date :** 2026-05-15
**Audit :** Track E.1 security audit + egress audit air-gap
**Source :** `scripts/audit-egress.sh` + Phase 1 backend egress mapping

À valider avec IT déployeur côté firewall sortant.

---

## 1. Backend egress (sortants depuis le container `xch-backend`)

Tous les endpoints sortants sont **configurables via env var** et **désactivables** (no-op si manquant).

### À whitelister selon mode déploiement

| Service | Env var(s) | Direction | Mode air-gap strict | Mode cloud / VPS |
|---|---|---|---|---|
| NetBox API | `NETBOX_URL`, `NETBOX_TOKEN` | sortant TCP/443 | Interne `<NETBOX_URL>` LAN | Externe ou interne |
| GlitchTip ingestion | `GLITCHTIP_DSN_BACKEND` | sortant TCP/443 ou /8000 | Interne `<GLITCHTIP_DSN_BACKEND>` (même VM ou autre VM LAN) | Externe ou interne |
| SMTP relay | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM` | sortant TCP/465 ou /587 | Interne `<SMTP_RELAY>` Postfix LAN | Externe ou interne |
| Email default FROM | (hardcoded fallback `noreply@xch.local`) | — | Override `SMTP_FROM=noreply@<DEPLOY_DOMAIN>` | idem |

### Interne au tenant (jamais externe)

| Service | Env var(s) | Réseau |
|---|---|---|
| PostgreSQL | (interne docker network) | LAN container |
| Redis | `REDIS_HOST`, `REDIS_PORT` | LAN container |
| MinIO | `MINIO_ENDPOINT`, `MINIO_PUBLIC_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | LAN container OU LAN VM |
| Monitoring HTTP probes | configuré par monitor (user-defined) | LAN par défaut, externe si user le veut |

---

## 2. Frontend egress (depuis le browser de l'opérateur)

### Externes hardcodés (CSP `frontend/src/lib/csp.ts`) — **bloquant air-gap strict**

| Hôte | Usage | Décision Track E.3 (Option A retenue) |
|---|---|---|
| `fonts.googleapis.com` + `fonts.gstatic.com` | Google Fonts (Inter) via `next/font/google` | **Self-host** via `next/font/local` + WOFF2 dans `/public/fonts/` |
| `*.tile.openstreetmap.org` | OSM tiles (light theme) Leaflet TileLayer | **Self-host** tile cache MinIO bucket `xch-map-tiles` (pré-bundlé country-level MBTiles) |
| `*.basemaps.cartocdn.com` | CartoDB Dark Matter (dark theme) | idem MinIO bucket |
| `unpkg.com` | Leaflet default marker PNGs | **Self-host** copie `node_modules/leaflet/dist/images/*` → `/public/leaflet/` |
| `raw.githubusercontent.com` (pointhi/leaflet-color-markers) | Color markers PNGs | **Self-host** copie → `/public/markers/` |
| `nominatim.openstreetmap.org` | Geocoding (address → lat/lng) | **Self-host** Nominatim container OU skip + lat/lng manuel |

### Configurable

| Hôte | Env var | Notes |
|---|---|---|
| `<GLITCHTIP_INGEST_ORIGIN>` (browser SDK) | `NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND` | Origin extraite du DSN — no-op si DSN absent |
| `<API_BASE_URL>` (same-origin via nginx) | `NEXT_PUBLIC_API_URL` (vide = same-origin) | LAN |

---

## 3. Whitelist firewall (template à compléter par opérateur)

### Mode air-gap strict (pilote)

```
# Outbound depuis VM xch-prod (uniquement) — TOUT le reste = DENY
# (Adapter <DEPLOY_DOMAIN>, <NETBOX_URL>, <SMTP_RELAY>, <NTP_SOURCE> à l'install)

# Service NetBox interne (si activé)
ALLOW tcp/443  xch-prod → <NETBOX_URL>

# Service GlitchTip self-hosted (si activé — même VM ou autre VM LAN client)
ALLOW tcp/8000 xch-prod → <GLITCHTIP_DSN_BACKEND_HOST>

# Service SMTP relay (si activé — Postfix interne client)
ALLOW tcp/587  xch-prod → <SMTP_RELAY>
ALLOW tcp/465  xch-prod → <SMTP_RELAY>

# NTP interne client (cf. décision D3.11 Track E v2.1)
ALLOW udp/123  xch-prod → <NTP_SOURCE>

# DNS interne client
ALLOW udp/53   xch-prod → <DNS_INTERNE>

# Refus explicite
DENY  *        xch-prod → 0.0.0.0/0   (catch-all log + drop)
```

### Mode cloud public / VPS

Ajouter à la liste :
- `ALLOW tcp/443 xch-prod → registry-1.docker.io` (image pull si pas de mirror interne)
- `ALLOW tcp/443 xch-prod → acme-v02.api.letsencrypt.org` (Let's Encrypt renewals)
- `ALLOW tcp/443 xch-prod → pool.ntp.org` (NTP public si pas de NTP interne)
- Selon SSO cloud : `ALLOW tcp/443 xch-prod → login.microsoftonline.com` (Entra ID) ou autre

### Mode cloud privé client

Selon infra client (OIDC interne, registry mirror, NTP interne) — variation du mode air-gap.

---

## 4. Validation runtime

Sur xch-prod déployé, exécuter :
```bash
bash scripts/audit-egress.sh --strict
```

En mode strict, les 4 assertions doivent PASS :
1. `curl https://sentry.io` depuis `xch-backend` → ECONNREFUSED / ETIMEDOUT (firewall bloque)
2. `getent hosts sentry.io` → NXDOMAIN (DNS interne ne résout pas)
3. `curl http://<GLITCHTIP_INGEST_HOST>:8000/api/0/` → HTTP 401 ou 405 (service écoute)
4. `grep sentry.io backend/src + frontend/src` → 0 match (déjà validé E.1 audit)
