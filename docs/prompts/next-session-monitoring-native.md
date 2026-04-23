# Prompt de session — Module monitoring natif XCH (suite ADR-012)

**À utiliser tel quel en ouverture de session** pour reprendre le sujet monitoring là où on l'a laissé. Ce prompt présuppose que la session lit d'abord sa mémoire MCP (entités XCH), `PROJECT_STATUS.md`, `CHANGELOG.md` et `AUTH_MODEL.md` — rien à recharger manuellement.

## MISES À JOUR 2026-04-24 (après phases 6.5 → 6.7)

Depuis la rédaction initiale (phase 6.6), le contexte a évolué :

1. **Numéro ADR** : utiliser **`ADR-014`** (et non « 012 bis »). ADR-013 est déjà pris par « Dette JSON résiduelle post-phase 6.6 » (`docs/decisions/adr-013-residual-json-debt.md`) — c'est lui qui trace `NotificationConfig` et `Asset.networkInfo` comme dettes JSON restantes. Le monitoring natif passe **avant** la refacto d'`Asset.networkInfo` (décision mémoire `feedback_monitoring_session_scope.md`) car il écrit sur `asset.networkInfo.monitorName/monitorStatus/lastHealthCheck`.

2. **`targetType` étendu** : la liste `'asset'|'link'|'site'` reste la cible v1. Optionnel : `'sdwan'` pour monitorer la config SD-WAN elle-même — mais en pratique le statut SD-WAN se déduit déjà des firewalls attachés (cf. `SdwanConfig` + `SdwanFirewall` en phase 6.6, lire `backend/src/modules/sdwan/sdwan.service.ts`). **Recommandation : rester sur 3 target types, laisser SD-WAN s'hydrater via ses firewalls (asset targetType).** Documenter ce choix dans l'ADR.

3. **Legacy fields conservés** : `ConnectivityLink.monitorName/status` (phase 6.5) et `SdwanConfig.monitorName/status` (phase 6.6) restent comme chemin **optionnel** pour les providers externes (Uptime Kuma, Gatus) — zéro breaking change. Le `MonitorCheck` natif écrit sur un **second chemin parallèle**, et l'agrégation `HealthAggregationService` priorise le natif si présent, sinon retombe sur l'externe.

4. **Pattern d'accès standardisé** (depuis phase 6.7) :
   - Tous les controllers utilisent `@RequireWrite()` ou `@RequireManage()` + helper `scopeOrFail(req, filterDelegationId)` qui vérifie que la délégation est dans le scope managé.
   - `PermissionService.getManagedDelegationIds(tenantId, userId)` retourne `null` pour super-admin (accès total) ou `string[]` managés.
   - **Reco pour MonitorCheck** : `@RequireWrite()` sur CRUD (c'est opérationnel, pas admin), + `scopeOrFail` qui vérifie que `targetId.delegationId ∈ scope` avant d'écrire.

5. **Discipline build prod** : **toujours** `docker compose build --no-cache backend frontend` après un code change (observé 2026-04-22 : un fix n'apparaissait pas dans `/app/dist/main.js` sans `--no-cache`). Cf. mémoire `project_deploy_workflow.md`.

6. **Credentials tests** :
   - `admin@demo.fr` → password **`Demo1234`** (super-admin, setup wizard)
   - Tous les autres `@demo.fr` (manager, multi, technicien, viewer) → password **`demo123`** (bcrypt dans `createUsers()` ligne ~401 du seed)
   - URL pilote publique : **`https://xch.eoncom.io`** (pas l'IP directe)

7. **Pattern export CSV** : si la session ajoute une page d'historique/dashboard monitoring, suivre le pattern existant de `/costs/new` / `/costs/budgets` / `/costs/reports` : bouton `<Download />` + UTF-8 BOM + `;` délimiteur pour Excel fr-FR.

Le reste du prompt (9 lots, BullMQ worker, ICMP via `ping` + fallback TCP, architecture 2-container) **est inchangé et applicable tel quel**.

---

---

## Prompt à copier/coller

```
Reprise : implémentation du module monitoring natif XCH (ADR-014).

PRINCIPE DIRECTEUR XCH (règle projet énoncée par l'utilisateur le
2026-04-20, s'applique à toutes les sessions) :

  "Toujours faire propre, pas de dette technique.
   L'app doit être développée selon les règles de l'art d'aujourd'hui.
   Harmoniser, cohérence, effacer toute dette — sans négliger la sécurité."

Conséquences concrètes pour cette session :
  - Le modèle MonitorCheck + MonitorResult sont des tables Prisma
    structurées (pas de JSON "sac à tout"). Un champ target en string
    est OK car la sémantique (host/url/ip) est unifiée ; un champ
    config HTTP plus riche (headers, method, expected status)
    justifiera un deuxième modèle MonitorHttpConfig en 1:0-1 avec
    MonitorCheck, pas un JSON optional.
  - Le worker NestJS est un process séparé avec ses propres deps
    minimales, permissions limitées (CAP_NET_RAW seulement), image
    partagée avec l'API pour éviter la duplication de build.
  - Sécurité : le worker n'expose AUCUN port HTTP. Probes timeout
    courts. Rate-limiting interne (max N probes parallèles). Pas de
    SSRF : le target d'un HTTP probe doit être validé contre une
    allowlist de schèmes (http/https) et bloquer localhost/link-local
    par défaut. Ajouter un toggle "allow internal targets" par tenant.
  - Code coverage raisonnable sur le probe core (TCP/HTTP/ICMP
    individuellement testables).
  - Zéro dette : pas de "on mettra un TODO quelque part", pas de
    "// TODO: clean up later". Si un choix pose dette, prendre l'option
    qui ne pose pas.


CONTEXTE
--------
Dans les sessions précédentes on a :
1. Exploré Gatus / Uptime Kuma / Kener comme options d'intégration
   bidirectionnelle — tous ces outils sont YAML-config-driven, pas
   API-first, donc impropres à un pilotage dynamique depuis XCH.
2. Décidé (tu peux relire le début de adr-012-gatus-bidirectional.md
   pour le contexte, mais SON APPROCHE EST ABANDONNÉE) que la bonne
   direction est un **module monitoring natif XCH** qui fait ping /
   HTTP / TCP directement, stocke les résultats en DB, et alerte via
   le NotificationService existant. Les providers Gatus et Uptime
   Kuma EXISTANTS restent en place comme providers optionnels pour
   des clients qui en auraient déjà — on ne casse rien.
3. Validé une architecture en DEUX conteneurs à partir d'une MÊME
   image Docker :
   - `xch-backend-api` (mode actuel, expose HTTP 3000)
   - `xch-backend-worker` (nouveau, pas d'HTTP, cap_add NET_RAW, lance
     `node dist/main --worker`, consomme une queue BullMQ et fait les
     probes)
   BullMQ + Redis sont déjà dans le stack (backend/src/app.module.ts),
   pas de nouvelle dépendance.

OBJECTIFS DE LA SESSION
-----------------------
Écrire l'ADR-014 puis implémenter en 9 lots (~10h) :

Lot 1 — Schema :
  - Nouveau modèle Prisma `MonitorCheck` (id, tenantId, targetType:
    'asset'|'link'|'site', targetId, kind: 'ping'|'http'|'tcp',
    target: string (ip/host/url), intervalSec: int, enabled: bool,
    lastCheckedAt, nextCheckAt, createdBy, createdAt, updatedAt).
  - Nouveau modèle `MonitorResult` (id, checkId FK, status: 'up'|
    'down'|'unknown', responseMs, error, checkedAt) avec index
    (checkId, checkedAt desc).
  - Relations inverses sur Asset / ConnectivityLink / Site pour
    naviguer depuis l'entité.

Lot 2 — Refactor `main.ts` + WorkerModule :
  - Détection du mode via `process.argv.includes('--worker')` ou
    `XCH_MODE=worker`.
  - `WorkerModule` importe DatabaseModule, ConfigModule, NotificationsModule,
    MonitoringModule. PAS d'AuthModule, PAS de controllers.
  - API mode continue de charger AppModule normalement.

Lot 3 — `MonitoringModule` (probes + scheduler + processor) :
  - `TcpProbe` via net.createConnection + timeout + RTT.
  - `HttpProbe` via axios avec validateStatus, timeout, follow redirects.
  - `IcmpProbe` : tente ICMP réel via le package `ping` si CAP_NET_RAW
    est présent, fallback TCP ping port 80 sinon. Log un warning une
    seule fois au démarrage si fallback.
  - `MonitorScheduler` (`@Cron('*/30 * * * * *')`) picke les checks
    `enabled && nextCheckAt < now`, push en BullMQ queue `monitor-check`.
  - `MonitorProcessor` (`@Processor('monitor-check')`) consume, dispatch
    sur le probe approprié, écrit `MonitorResult`, compare au précédent,
    sur transition UP→DOWN : `NotificationService.dispatch({ event:
    'MONITOR_DOWN', delegationId: <résolu depuis target>, context })`.
    Sur DOWN→UP : event `MONITOR_UP`. Met à jour `lastCheckedAt` et
    `nextCheckAt` du check.
  - Exponential backoff retry BullMQ pour les erreurs transitoires
    (connexion refused, DNS fail) — 3 tentatives avant de logger down.

Lot 4 — API endpoints (CRUD MonitorCheck dans AppModule, pas le worker) :
  - `POST /api/monitors` — `@RequireWrite()` + vérif WRITE sur le site
    parent si targetType=asset|link|site.
  - `GET /api/monitors` — filtre par targetType / targetId / enabled.
    Scope serveur par délégation (standard).
  - `GET /api/monitors/:id` + `PATCH :id` + `DELETE :id`.
  - `GET /api/monitors/:id/history?limit=50` — liste MonitorResult paginée,
    décroissante par checkedAt. Pour l'UI historique.
  - `GET /api/monitors/:id/summary` — % uptime 24h / 7j / 30j (calcul en
    SQL).
  - `POST /api/monitors/:id/run-now` — ajoute un job en queue sans
    attendre le cron, pour le test utilisateur. `@RequireWrite()`.

Lot 5 — docker-compose :
  - Ajouter service `xch-backend-worker` qui réutilise l'image
    `xch-backend`, command `node dist/main --worker`.
  - `cap_add: [NET_RAW]` pour l'ICMP.
  - `depends_on: [xch-postgres, xch-redis]`, mêmes env vars que l'API.
  - Pas de port exposé. Pas de healthcheck HTTP — healthcheck interne
    via un petit endpoint de socket ou un job BullMQ self-ping.
  - Dev (`docker-compose.override.yml`) : 1 worker. Prod
    (`docker-compose.prod.yml`) : 1 worker, prêt à scaler avec
    `--scale`.

Lot 6 — Frontend : toggle + config monitor par entité :
  - Nouveau composant `<MonitorConfigSection>` embedded dans :
    - `assets/[id]/page.tsx` (tab "Monitoring" ou dans Info)
    - `ConnectivityLinksManager` (checkbox par link)
    - `sites/[id]/page.tsx` (site-level — permet monitor d'un host/url
      générique du chantier)
  - Le composant permet : toggle enabled, choix kind (ping/http/tcp),
    target (pré-rempli depuis networkInfo.ip ou publicIp), intervalSec
    (slider 60s/5min/15min/1h).
  - Bouton "Run now" qui appelle POST /monitors/:id/run-now.
  - Bouton "Désactiver" + warning si alertes en cours.

Lot 7 — Frontend : page historique par monitor :
  - Route `/dashboard/monitors/:id` ou tab sur la fiche entité.
  - Graphe simple en ASCII/bars des 100 derniers résultats (pas
    besoin de lib lourde, du Tailwind suffit pour la v1).
  - Badge uptime % sur 24h / 7j / 30j.
  - Table paginée des résultats avec filtre up/down.

Lot 8 — Intégration `NotificationConfig` :
  - Ajouter deux event types dans `backend/src/modules/notifications/
    notification-events.ts` :
    - `MONITOR_DOWN` (category: monitoring, default channels: [email, teams])
    - `MONITOR_UP` (category: monitoring, default channels: [email, teams])
  - Le worker appelle `NotificationService.dispatch` avec le bon
    delegationId (résolu via target → site → delegation). Le routeur
    existant (hérite du global si pas de config délégation) fait le
    reste — aucun refactor routeur nécessaire.

Lot 9 — Deploy + tests fumée :
  - Build backend (même image, démarre API et worker depuis le même
    dist).
  - Reset DB + reseed. Ajouter 2-3 MonitorCheck démo dans le seed pour
    que le pilote ait des données visibles (ex: ping 1.1.1.1 pour le
    site DEF-01, HTTP check sur une URL Orange pour le link PRIMARY).
  - Curl : créer un check → vérifier qu'un MonitorResult apparaît en
    DB dans les 60s → `run-now` → déclencher un DOWN factice →
    vérifier qu'une UserNotification est émise.

DÉCISIONS DÉJÀ PRISES (ne pas redébattre sauf si je le demande)
---------------------------------------------------------------
- Option retenue : **Option B** (même codebase, deux containers).
- Option A (monolithe pur) rejetée pour l'isolation de crash, la
  sécurité CAP_NET_RAW limitée au worker, et la scalabilité horizontale.
- Gatus bidirectionnel abandonné (ADR-012 original archivé).
- Gatus et Uptime Kuma READ-only gardés en tant que providers optionnels
  pour les tenants qui en auraient déjà — zéro breaking change.
- Notifications : XCH reste le router (NotificationConfig par délégation,
  ADR-009). Le worker est un producer parmi d'autres, comme les crons
  warranty/due-tasks existants.
- ICMP ping : v1 accepte le fallback TCP port 80 si CAP_NET_RAW
  manque. Vrai ICMP quand le cap est présent.
- Volumétrie pilote : ~100-500 checks, 1/5min → ~2 req/s sur le worker.
  Largement supportable par un NestJS BullMQ. Scaling à revoir si
  on franchit 10k checks.

AVANT DE CODER
--------------
1. Lire `docs/decisions/adr-012-gatus-bidirectional.md` (contexte
   abandonné). Nouveau numéro imposé : **ADR-014** — ADR-013 est déjà
   pris par « Dette JSON résiduelle post-phase 6.6 » (`adr-013-residual-json-debt.md`).
2. Lire `backend/src/modules/integrations/interfaces/integration-provider.
   interface.ts` — la MonitoringProvider interface existante. Le
   module natif peut soit l'implémenter aussi (elegant), soit
   coexister en parallèle.
3. Lire `backend/src/modules/notifications/notification-events.ts` pour
   comprendre où ajouter les events MONITOR_DOWN/UP.
4. Lire `backend/src/app.module.ts` — BullModule + ScheduleModule déjà
   présents, noter juste la config Redis.

WORKFLOW
--------
Même pattern que phases précédentes :
1. ADR d'abord, validation user.
2. 9 lots en commits atomiques par lot.
3. Push main au fur et à mesure.
4. Un seul rebuild backend + frontend à la fin (backend rebuild aussi
   le worker puisque même image).
5. Tests curl post-deploy + rapport.

CONTRAINTES
-----------
- Pas de rebuild intermédiaire (gain de temps).
- Backward compat : les providers Uptime Kuma + Gatus existants ne sont
  PAS cassés. Tests de non-régression sur le webhook entrant après
  déploiement.
- `prisma db push --accept-data-loss` est OK — les MonitorCheck /
  MonitorResult sont vides à la création.
- User a confirmé que les données courantes sont démo : reset + reseed
  autorisé.

POINT OUVERT À REVALIDER EN DÉBUT DE SESSION
---------------------------------------------
Scope v1 du champ `target` sur MonitorCheck : simple string suffisante
(hôte/IP/URL selon kind), ou besoin d'un objet structuré (port, path,
méthode, headers pour HTTP) ? Recommandation : simple string +
kind-specific parsing. Peut évoluer si besoin réel émerge.

Fin du prompt. Réponds par "OK, je rédige l'ADR-014" et on démarre.
```

---

## Notes d'accompagnement (pour moi / contexte humain)

- L'ADR-012 original (Gatus bidirectionnel) reste dans `docs/decisions/` comme archive de la réflexion — il documente ce qui a été rejeté.
- La numérotation ADR peut être **ADR-013 (Native monitoring module)** plutôt que « ADR-012 bis » pour rester propre. À l'appréciation du repreneur.
- Le prompt-ci est **self-contained** : une session qui démarre avec ce texte + la mémoire MCP classique a tout le contexte pour avancer sans aller-retour préliminaire.
- Si le repreneur veut revoir une décision (ex: essayer quand même Kener, discuter autre langage que Node.js pour le worker), lui rappeler qu'elles sont fermées — sauf demande explicite utilisateur.
- Charge réelle attendue : plutôt 10-12h qu'un pilote complet, selon la richesse des écrans frontend. La base API peut être livrée en 4-5h si on coupe l'UI historique.
