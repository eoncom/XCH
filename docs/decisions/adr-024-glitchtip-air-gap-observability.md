# ADR-024 : GlitchTip self-hosted air-gap observability

Date : 2026-05-09
Statut : Accepté
Tag cible : v2.1.0 (post-S9, S8 chantier dédié)
Dépendances :
- v2.0.0 (baseline 100% DTO + CSP nonce strict)
- ADR-021 (RBAC universal data filtering — fail-closed semantics réutilisée pour scrubber)
- ADR-014 (api/worker mode dispatcher — base du tag `mode` Sentry)
- S9 PR #15 (anti-leak DTO discipline — `SECRET_REGEX_BUNDLE` réutilisé)

## Contexte

XCH est un produit qui se déploie chez des clients en environnements
**pilotes/prod-pilote isolés** (chantiers temporaires, infra cliente,
eventuellement air-gap réel sur sites sensibles). Toute télémétrie
sortante non maîtrisée est :

1. **Un blocage commercial** — certains clients refusent toute
   exfiltration de données, même métriques d'erreur. Sentry SaaS public
   (`sentry.io`) ou tout équivalent SaaS hébergé hors juridiction
   client est exclu d'office.
2. **Une surface d'incident** — un payload d'erreur mal scrubé
   contient potentiellement de la PII (email, prénom, identifiants) ou
   des secrets (token JWT en stack trace, password hash en mémoire,
   TOTP base32 dans un context). Le risque grimpe avec le volume.
3. **Un coupling externe non garanti** — Sentry SaaS peut changer ses
   conditions, sa juridiction de stockage, ou simplement cesser le
   plan gratuit. Pour XCH multi-pilotes, ce risque n'est pas
   acceptable.

Avant S8 / v2.1.0, l'observabilité côté backend reposait UNIQUEMENT sur
les logs structurés (`WorkerEventLogger`, NestJS Logger) ingérés par
Loki/promtail. Côté frontend, aucune télémétrie. Diagnostic d'incident
post-mortem = grep dans les logs Loki sur les fenêtres temporelles
suspectes, peu efficace pour détecter un crash silencieux côté
browser ou un job-failed enterré dans le bruit.

## Décision

S8 (chantier "GlitchTip self-hosted observability") établit une
plateforme de capture d'erreurs **air-gap par construction**, déployée
en parallèle de la stack XCH (cycle de vie indépendant) et instrumentée
via Sentry SDK officiel (compat-API Sentry conservée par GlitchTip),
avec les invariants suivants :

### 1. Aucun forwarding externe

- Pas de DSN pointant vers `sentry.io` ou autre SaaS dans la stack
  XCH déployée. Vérifié à 2 niveaux :
  - **Statique** : `scripts/audit-egress.sh` assertion 4
    (`grep -rE 'sentry\.io' backend/src + frontend/src` = 0 match,
    bloquante en tous modes).
  - **Runtime** : assertions 1+2 du même script — `node` HTTP probe
    depuis `xch-backend` vers https://sentry.io doit échouer
    (mode `--strict`), et la résolution DNS `sentry.io` doit NXDOMAIN
    (idem).
- Tout flow sortant côté frontend (browser SDK) doit pointer vers le
  domaine GlitchTip self-hosted exposé par NPM (Let's Encrypt) sur le
  réseau client/pilote — JAMAIS un domaine tiers.

### 2. Architecture stack GlitchTip dédiée

`docker-compose.glitchtip.yml` à la racine du repo, **séparé** du
compose principal XCH :
- **Cycle de vie indépendant** — `up -d` / `down` ne touche pas la
  stack XCH ; option B compose dédié retenue contre option A
  extension du compose principal (architecture plus propre pour la
  duplication multi-pilotes).
- **5 services** : `glitchtip-postgres` + `glitchtip-redis` +
  `glitchtip-web` + `glitchtip-worker` (Celery) +
  `glitchtip-admin-seed` (init job idempotent).
- **2 réseaux** : `glitchtip-internal` privé (DB+redis+worker+web pas
  exposés hors compose) + `xch-network` external avec **alias DNS
  `glitchtip`** sur `glitchtip-web` pour que NPM puisse pointer
  `proxy_pass http://glitchtip:8000`.
- **Image pinnée** `glitchtip/glitchtip:v4.1` — la version pin est
  une dépendance dure de `glitchtip/scripts/_gen_dsn.py` (cf §Risk
  ci-dessous).

### 3. 3 projets GlitchTip + tag-based filtering

Plutôt que 4 projets séparés (un par runtime), on utilise **3 projets
+ tags** :

| Projet GlitchTip | Tag distinguer | Provenance |
|---|---|---|
| `xch-backend` | `mode=api` | NestJS HTTP server |
| `xch-backend` | `mode=worker` | NestJS BullMQ worker (mode `--worker`) |
| `xch-frontend` | `runtime=browser` | bundle navigateur |
| `xch-frontend` | `runtime=ssr` | Next.js Node SSR/RSC |
| `xch-frontend` | `runtime=edge` | Next.js middleware/edge runtime |

Justification :
- Backend api/worker partagent le même process tree, le même DSN, la
  même base de stack frames. Les séparer en 2 projets dédoublerait la
  complexité sans gain (filtre par facette `mode` côté UI suffit pour
  router vers la bonne équipe d'astreinte).
- Frontend a 3 runtimes mais ils partagent la même base de code
  (browser/SSR/edge sont 3 sorties de bundle Next.js), donc même
  projet + tag.
- Un seul DSN par projet = moins d'env vars à maintenir + moins de
  drift possible.

Trade-off accepté : si on doit changer la rétention ou les alertes
différemment pour api vs worker, il faudrait ajouter des règles
GlitchTip projet-level qu'on filterait par tag — un peu plus indirect
qu'avoir 2 projets séparés. Pas de besoin actuel.

### 4. DSN différenciés par audience

Backend/worker → **DSN interne** Docker `http://<key>@glitchtip-web:8000/<id>`
- Bypass NPM, Let's Encrypt, internet — réseau Docker direct.
- Gain : latence négligeable au capture, pas de cert handshake, et
  surtout JAMAIS de leak vers internet même si le firewall outbound
  est mal configuré.

Frontend (browser ET SSR) → **DSN public** `https://<key>@glitch.eoncom.io/<id>`
- Browser ne peut pas joindre le réseau Docker interne par construction
  (pas de DNS, pas de routing).
- SSR Next.js pourrait théoriquement utiliser le DSN interne, mais on
  préfère un seul DSN pour les 2 runtimes (KISS) — coût marginal d'un
  TLS handshake par init de process.

### 5. Scrubber `beforeSend` fail-closed (anti-leak runtime)

Single source of truth : `backend/src/common/observability/glitchtip/
scrubber.ts` exporte `SECRET_REGEX_BUNDLE` (déplacé depuis
`backend/src/modules/auth/dto-shape.spec.ts` S9 PR #15) — bundle de
~13 regex couvrant les noms de champs sensibles
(`passwordHash`, `totpSecret`, `inviteToken`, `resetToken`,
`failedLoginAttempts`, `externalId`, …) et leurs valeurs canoniques
(bcrypt prefix, TOTP base32, hex tokens).

Le hook `beforeSend` Sentry :
1. Sérialise l'event entier en JSON.
2. Si UN match du bundle → **drop l'event entier** (return null).
   Rationale : un match signal qu'un secret a fuité dans un message,
   un context, ou un breadcrumb ; un redact partiel laisserait passer
   les fragments adjacents. L'event reste consultable dans les logs
   applicatifs (qui ont leur propre scrubbing).
3. Sinon, drop ciblé : `user.email` ENTIÈREMENT (décision XCH
   2026-05-08, garde uniquement `user.id` UUID),
   `request.cookies`, `Authorization` / `Cookie` / `X-CSRF-Token`
   headers, `request.data` (body).

Frontend a son propre scrubber jumeau (`frontend/src/lib/observability/
glitchtip-scrubber.ts`) sans le bundle (le frontend ne manipule pas la
DB), mais avec :
- Filtre des erreurs LÉGITIMES qui pollueraient le signal sans être
  actionables : `AbortError`, `ChunkLoadError`, `Loading chunk N
  failed`, HTTP 401/403/404 (RBAC fail-closed ADR-021 + deep-link UX
  S5 PR1).
- Même drop `user.email` / cookies / auth headers / body.

### 6. Endpoints synthèse `_test-error` gated dur

Pour valider la chaîne end-to-end (3 events visibles UI GlitchTip
avec tags propres = critère acceptance v2.1.0), on a besoin de 3
points de génération synthétique. Mais ces endpoints sont une
**surface d'attaque** (génération de bruit dans Sentry par n'importe
quel user authentifié) — donc gated dur :

1. `ENABLE_TEST_ERROR_ENDPOINTS=true` env (backend) ou
   `NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=true` (frontend, bundlé build) — désactivé par défaut.
2. `req.user.isSuperAdmin` côté backend (via `@SkipDelegation @RequireManage`,
   `PermissionGuard`) ou `useAuthStore().user?.isSuperAdmin` côté
   frontend.

Si flag OFF → backend retourne **404** (pas 403) pour ne pas
info-leak l'existence de la route. Frontend affiche message
"désactivé" / "accès refusé".

**Règle non négociable en prod entreprise multi-tenant : flags à
`false`.** À activer ponctuellement par un opérateur avec
super-admin pour smoke tests post-deploy, puis désactiver +
rebuild frontend (NEXT_PUBLIC bundlé build).

## Procédure bootstrap reproductible

À suivre sur tout nouvel environnement (xch-deploy initial, futurs
pilotes) après merge v2.1.0 :

```bash
ssh <host>
cd /opt/xch-dev/XCH
git fetch --tags
git checkout v2.1.0   # ou la dernière 2.1.x

# 1. Déterminer le nom complet du réseau xch-network selon le project-name
docker network ls | grep xch-network
# Exemple: xch_xch-network (project-name=xch)

# 2. Générer secrets glitchtip
bash glitchtip/scripts/gen-secrets.sh
# → glitchtip/.env créé (mode 600) avec SECRET_KEY/POSTGRES/ADMIN_PASSWORD random

# 3. Ajuster XCH_NETWORK_NAME dans glitchtip/.env (si différent du défaut)
sed -i "s|^XCH_NETWORK_NAME=.*|XCH_NETWORK_NAME=xch_xch-network|" glitchtip/.env

# 4. Démarrer la stack GlitchTip
docker compose -f docker-compose.glitchtip.yml --env-file glitchtip/.env up -d
# → 5 containers, glitchtip-admin-seed exit 0 ("Created superuser admin@xch.local")

# 5. Récupérer 3 DSN (création org/team/projets/membership en une commande)
bash glitchtip/scripts/gen-dsn.sh --json | python3 -c "..."
# → 3 lignes prêtes à coller :
#   GLITCHTIP_DSN_BACKEND=http://<key>@glitchtip-web:8000/<id>
#   GLITCHTIP_DSN_WORKER=http://<key>@glitchtip-web:8000/<id>   (réservé futur)
#   NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=https://<key>@glitch.eoncom.io/<id>

# 6. Coller dans backend/.env + frontend/.env
# (manuel ou automatisé via deploy-auto.sh — backlog)

# 7. NPM (côté infra réseau pilote, hors scope ce repo) :
#    Créer un proxy host glitch.eoncom.io → http://glitchtip:8000
#    avec Let's Encrypt cert. Le DNS doit pointer vers le host réseau
#    qui tourne NPM.

# 8. Rebuild + restart les 3 conteneurs XCH (frontend NEXT_PUBLIC bundlé build)
set -a; source frontend/.env; set +a
docker compose build backend backend-worker frontend
docker compose up -d backend backend-worker frontend

# 9. Audit air-gap
bash scripts/audit-egress.sh           # mode défaut (relaxed dev/test)
bash scripts/audit-egress.sh --strict  # mode prod air-gap (assertions 1+2 bloquantes)

# 10. Validation runtime (1 fois par environnement, optionnel)
#    Activer ENABLE_TEST_ERROR_ENDPOINTS=true + NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=true
#    (rebuild frontend obligatoire), trigger les 3 endpoints, voir 3 events
#    dans GlitchTip UI (https://glitch.eoncom.io), puis désactiver les flags.
#    Cf glitchtip/VALIDATION-S8.md pour le détail.
```

**Mode `--strict` audit-egress = OBLIGATOIRE en prod entreprise / pilote
client.** Sans `--strict`, les assertions 1+2 (egress sentry.io + DNS
sentry.io) ne sont qu'informationnelles, ce qui est acceptable sur
xch-deploy (dev/test internet-ouvert) mais pas en prod air-gap réelle.
Le piège futur (= pas appliquer `--strict` en prod et croire qu'on est
air-gap parce que `audit-egress.sh` rend exit 0) est **explicitement
documenté** ici pour ne pas se faire avoir au prochain pilote
contractualisé.

## Conséquences

### Positives

- Capture d'erreurs centralisée pour les 4 runtimes (api / worker /
  browser / SSR) avec stack traces, tags, user.id, contexts —
  diagnostic post-mortem accéléré vs grep Loki seul.
- 3 niveaux de défense anti-leak : DTO discipline ADR-023 (wire shape
  whitelist), scrubber `beforeSend` fail-closed (filet runtime),
  drop user.email (PII contention).
- Air-gap par construction : 4 assertions automatisables
  (`audit-egress.sh`) + Self-hosted = compatible bascule prod
  entreprise multi-tenant sans changement de config.
- Single source of truth `SECRET_REGEX_BUNDLE` partagée entre les
  tests anti-leak DTO et le scrubber Sentry — pas de drift possible.
- Procédure bootstrap reproductible scriptée : `gen-secrets` + `gen-dsn`
  font le bootstrap one-shot en idempotent (re-run safe).

### Négatives / Compromis

- **Pas de tracing / replay / profiling** côté Sentry. Coverage
  d'incident limitée aux exceptions ; visibilité fine perf et UX
  reste à faire via Loki et observabilité user-side custom.
- **Source maps frontend NON uploadées auto** en prod (compromis pour
  garder Konva externals — pas de `withSentryConfig` webpack plugin).
  Stack traces browser dans GlitchTip UI sont minifiées. Acceptable
  pour identifier l'erreur ; pour debug précis, soit upload manuel
  via `@sentry/cli` standalone (backlog), soit reproduire local en
  dev.
- **Coupling fort** au layout interne de GlitchTip v4.1 dans
  `glitchtip/scripts/_gen_dsn.py` (imports `apps.organizations_ext.models.
  Organization`/`OrganizationUser`/`OrganizationOwner`,
  `apps.teams.models.Team`, `apps.projects.models.Project`/`ProjectKey`).
  Cf §Risk.
- **Manuelle wire-up `sentry.client.config.ts`** côté frontend (import
  side-effect dans `Providers`). Si Next.js bump à 15.3+, on pourra
  migrer sur `instrumentation-client.ts` auto-loaded — meilleur
  rangement, à faire dans une session dédiée.
- **Stack supplémentaire à opérer** : 5 containers GlitchTip + DB +
  Redis dédiés. Coût mémoire ~500 MB, CPU négligeable au repos.
  Acceptable sur les pilotes actuels (machines dédiées) ; à
  reconsidérer si on cible des hosts contraints.

### Risk note — coupling `apps.*` GlitchTip si bump version

`glitchtip/scripts/_gen_dsn.py` consomme directement les modèles
Django internes de GlitchTip (`Organization`, `OrganizationUser`,
`OrganizationOwner`, `Team`, `Project`, `ProjectKey`). Ce coupling est
intentionnel (single-shot bootstrap, pas de hot-path, gain de
robustesse vs HTTP API cassée en v4.x) mais fragile : tout bump
GlitchTip image (v4.1 → v4.2 ou v5.0) DOIT être validé avant deploy
prod par un re-run de `gen-dsn.sh --dry-run` sur l'image candidate
(audit JSON `error` field signale tout import échoué).

À DÉCLENCHER MANUELLEMENT à chaque bump :
1. `docker compose -f docker-compose.glitchtip.yml --env-file glitchtip/.env up -d` avec la nouvelle image.
2. `bash glitchtip/scripts/gen-dsn.sh --dry-run --json` →
   doit afficher `"errors": []`.
3. Si erreurs (modèle/champ renommé/déplacé) : adapter
   `_gen_dsn.py` avant de bumper en prod.

Cette règle est inscrite dans le commit message du bump (à venir) et
dans le memory MCP `XCH_S8_GLITCHTIP_HANDOFF`.

## Alternatives considérées

1. **Sentry SaaS public** — rejetée : exfiltration externe non
   acceptable sur pilotes contractualisés. Coût mensuel non négligeable
   pour le volume cible.
2. **Sentry self-hosted full** — rejetée : stack >25 containers,
   complexité opérationnelle exorbitante pour le besoin XCH.
   GlitchTip = compat API + 5 containers, équilibre satisfaisant.
3. **Logs Loki seuls (no error tracker)** — rejetée pour S8 :
   diagnostic post-mortem acceptable mais pas la **détection
   proactive** ni l'**alerting** (GlitchTip déclenche notifications
   sur nouveaux types d'erreur, agrège les volumes par fingerprint).
   Loki reste utilisé en complément (events JSON structurés
   `BullEvent` + nginx access log).
4. **HTTP API GlitchTip pour bootstrap (au lieu d'ORM)** — rejetée
   après bootstrap test (S8 item 1) : `/api/0/auth/login/` retourne
   404 en v4.x (Sentry-compat retirée), endpoints orgs/projets non
   documentés et différents selon version. ORM via shell est plus
   robuste pour un script one-shot.
5. **`withSentryConfig` côté frontend** — rejetée : webpack plugin
   peut entrer en conflit avec `config.externals['canvas']` requis
   pour Konva SSR. Décision dure user 2026-05-09 : pas de tentative
   de débug webpack, fallback direct sur init manuel
   `instrumentation.ts` + `sentry.client.config.ts` import.

## Références

- Procédure deploy détaillée : §Procédure bootstrap reproductible ci-dessus
- Validation runtime utilisateur : `glitchtip/VALIDATION-S8.md`
- Critère acceptance v2.1.0 : 3 events visibles UI GlitchTip + audit-egress
  PASS — atteint 2026-05-09
- Memory MCP `XCH_S8_GLITCHTIP_HANDOFF` (knowledge graph) — contexte
  inter-session de cette ADR
