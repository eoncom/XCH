# ADR-014 : Module monitoring natif XCH (probes ICMP/HTTP/TCP + worker BullMQ)

**Date :** 2026-04-26
**Statut :** **Accepté** (validé utilisateur 2026-04-26, précisions §6/§7/§8 intégrées)
**Auteurs :** Lead technique, demande utilisateur (session monitoring 2026-04-26)
**Remplace partiellement :** [ADR-012 (Gatus bidirectionnel)](adr-012-gatus-bidirectional.md) — l'auto-register Gatus via sidecar YAML est abandonné
**Référence :** [ADR-009 (delegation-first)](adr-009-delegation-first-model.md), [ADR-013 (résidu JSON)](adr-013-residual-json-debt.md)

---

## Contexte

Le besoin métier reste celui exprimé en avril 2026 : **piloter dynamiquement le monitoring depuis XCH** (un site/asset/lien créé doit pouvoir être surveillé sans éditer un fichier de config externe), avec **routage des alertes via le `NotificationConfigService` existant** (héritage par délégation, ADR-009).

L'exploration de **Gatus** ([ADR-012](adr-012-gatus-bidirectional.md)) puis **Uptime Kuma** et **Kener** a montré que ces outils sont **config-driven** (YAML statique) et n'exposent aucune API CRUD pour les endpoints. Les pousser dynamiquement implique :

- Un sidecar `wget`/`crond` qui tire un YAML depuis XCH et le remet sur disque (ADR-012 option retenue).
- 5 min de latence entre toggle UI et endpoint actif.
- Un secret partagé machine-to-machine de plus à gérer.
- Une dépendance opérationnelle (le sidecar lâche → endpoints désynchronisés sans alerte).
- Un format YAML à maintenir, sensible aux breaking changes Gatus.

**Constat** : pour obtenir un monitoring piloté par API, il est plus propre d'écrire un **module natif** dans XCH que d'enrober un outil externe avec des hacks YAML. L'écosystème NestJS fournit déjà tout ce qu'il faut (BullMQ, ScheduleModule, Prisma, NotificationsModule), et les probes ICMP/HTTP/TCP sont triviales (≤ 200 lignes par probe).

Les providers Uptime Kuma et Gatus existants (`backend/src/modules/integrations/providers/*.provider.ts`) restent en place comme **providers READ-only optionnels** — un client qui possède déjà un Gatus/Kuma peut continuer à le brancher en webhook entrant sur `POST /api/integrations/monitoring/webhook?provider=…`. Aucun breaking change.

---

## Décision

### 1. Architecture — **deux containers, même image, mode worker via flag**

Une **seule image Docker `xch-backend`** est buildée. Elle est instanciée dans deux services docker-compose :

| Service | Commande | Ports | Capabilities |
|---|---|---|---|
| `xch-backend-api` | `node dist/main` | `3000` (HTTP) | aucune |
| `xch-backend-worker` | `node dist/main --worker` | aucun | `cap_add: [NET_RAW]` |

Le bootstrap (`main.ts`) détecte le mode :

- `process.argv.includes('--worker')` ou `XCH_MODE=worker` → charge `WorkerModule` (DatabaseModule, ConfigModule, NotificationsModule, MonitoringModule). **Pas d'AuthModule, pas de controllers, pas de port HTTP.**
- Sinon → charge `AppModule` normalement (mode actuel).

**Pourquoi deux containers et pas un monolithe :**

- **Isolation de crash** : un probe qui timeout ou un bug ICMP ne tue pas l'API.
- **Sécurité** : `CAP_NET_RAW` (ICMP) reste **confiné au worker**, l'API n'a pas besoin de privilèges réseau étendus.
- **Scalabilité horizontale** : `docker compose up --scale xch-backend-worker=3` quand on dépasse ~10k checks. L'API ne change pas.
- **Pas de duplication build** : la même image embarque les deux modes ; le `dist/` est partagé.

**Pourquoi pas un troisième repo / une lib partagée** : zéro intérêt à éclater le code. Le worker partage Prisma, les types, les services Notification — un repo unique est la solution la moins coûteuse en dette.

### 2. Schema — **modèles relationnels structurés, zéro JSON sac-à-tout**

Conformément à la règle projet « pas de dette technique » et à [ADR-013](adr-013-residual-json-debt.md) (résorption de la dette JSON), on n'utilise **aucun champ `Json`** pour la config monitor. Trois modèles :

```prisma
model MonitorCheck {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Polymorphic target — un seul des 3 FK est non-null (CHECK constraint).
  // On choisit l'option « FK séparées » plutôt que (targetType, targetId)
  // string pour conserver l'intégrité référentielle et le ON DELETE CASCADE.
  siteId       String?
  site         Site?    @relation(fields: [siteId], references: [id], onDelete: Cascade)
  assetId      String?
  asset        Asset?   @relation(fields: [assetId], references: [id], onDelete: Cascade)
  linkId       String?
  link         ConnectivityLink? @relation(fields: [linkId], references: [id], onDelete: Cascade)

  kind         MonitorKind   // ICMP | HTTP | TCP
  target       String        // host/IP/URL — sémantique selon kind
  targetPort   Int?          // requis si kind=TCP, nullable sinon
  intervalSec  Int           @default(300)  // 60 .. 3600

  enabled      Boolean       @default(true)
  lastCheckedAt DateTime?
  nextCheckAt   DateTime?
  lastStatus    MonitorStatus @default(UNKNOWN)

  // HTTP-specific config — relation 1:0-1, pas un JSON.
  // Null pour les checks ICMP/TCP. Présent et structuré pour HTTP avancé.
  httpConfig   MonitorHttpConfig?

  createdById  String?
  createdBy    User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  results      MonitorResult[]

  @@index([tenantId, enabled, nextCheckAt])
  @@index([siteId])
  @@index([assetId])
  @@index([linkId])
}

model MonitorHttpConfig {
  id              String  @id @default(cuid())
  checkId         String  @unique
  check           MonitorCheck @relation(fields: [checkId], references: [id], onDelete: Cascade)

  method          HttpMethod @default(GET)
  expectedStatus  Int        @default(200)   // 2xx range si on veut généraliser → champ dédié
  expectedBodyContains String?
  followRedirects Boolean    @default(true)
  timeoutMs       Int        @default(5000)
  // Headers : table fille MonitorHttpHeader si on en a vraiment besoin —
  // v1 : pas de headers customs. On évite la dette « Json headers ».
  // YAGNI strict : on ajoute MonitorHttpHeader le jour où le pilote en demande.
}

model MonitorResult {
  id          String   @id @default(cuid())
  checkId     String
  check       MonitorCheck @relation(fields: [checkId], references: [id], onDelete: Cascade)

  status      MonitorStatus  // UP | DOWN | UNKNOWN
  responseMs  Int?
  error       String?        @db.Text
  checkedAt   DateTime       @default(now())

  @@index([checkId, checkedAt(sort: Desc)])
}

enum MonitorKind {
  ICMP
  HTTP
  TCP
}

enum MonitorStatus {
  UP
  DOWN
  UNKNOWN
}

enum HttpMethod {
  GET
  HEAD
  POST
}
```

**Justifications :**

- **Polymorphisme par FK séparées** plutôt que `(targetType, targetId)` string : on conserve l'intégrité référentielle Postgres et `onDelete: Cascade` (suppression d'un Site → ses MonitorCheck disparaissent automatiquement). Une CHECK constraint applicative + une migration ajoute `CHECK (num_nonnulls(siteId, assetId, linkId) = 1)`.
- **`MonitorHttpConfig` en 1:0-1** plutôt qu'un `Json httpConfig` : champs queryables, typés Prisma, pas de dette. Si on a vraiment besoin de headers custom (rare en infra interne), on ajoutera `MonitorHttpHeader[]` plus tard — on ne l'anticipe pas (YAGNI).
- **`targetPort Int?`** plutôt que parser `target` en string `"host:port"` : éviter le parsing fragile.
- **`lastStatus`** dénormalisé sur le check : évite un sous-select sur la dernière `MonitorResult` pour chaque liste UI (gain perf significatif sur le `GET /monitors`).
- **Index composite `(tenantId, enabled, nextCheckAt)`** : optimise la requête du scheduler (`WHERE enabled = true AND nextCheckAt <= now()`).

**Migration** : `prisma db push --accept-data-loss` (les tables sont nouvelles, vides à la création).

### 3. Worker — `WorkerModule` + probes + scheduler + processor

**Probes** (`backend/src/modules/monitoring/probes/`) — chacun unit-testable indépendamment :

- **`TcpProbe`** — `net.createConnection({ host, port, timeout })`, mesure RTT, retourne `{ status, responseMs, error }`.
- **`HttpProbe`** — `axios` avec `validateStatus`, `timeout`, `maxRedirects`. Vérifie `expectedStatus` et `expectedBodyContains` si présents.
- **`IcmpProbe`** — package `ping` natif. Au démarrage du worker :
  - Test une fois si CAP_NET_RAW est présent.
  - Si oui → vrai ICMP.
  - Sinon → fallback TCP port 80 + log warning **une seule fois** (pas de spam logs).

**`MonitorScheduler`** (`@Cron('*/30 * * * * *')`, exécution toutes les 30s) :

```
SELECT id FROM MonitorCheck
WHERE enabled = true
  AND (nextCheckAt IS NULL OR nextCheckAt <= now())
LIMIT 500
```

Push chaque id en queue BullMQ `monitor-check`, puis `nextCheckAt = now() + intervalSec` pour éviter les double-prises.

**`MonitorProcessor`** (`@Processor('monitor-check')`) :

1. Charge le `MonitorCheck` (avec httpConfig si HTTP).
2. Dispatch sur le bon probe.
3. Insère un `MonitorResult` avec `{status, responseMs, error}`.
4. Compare au `lastStatus` du check :
   - **UP → DOWN** : `NotificationService.dispatch({ eventType: MONITOR_DOWN, … })`.
   - **DOWN → UP** : `NotificationService.dispatch({ eventType: MONITOR_UP, … })`.
   - Sinon : rien.
5. Met à jour `lastStatus`, `lastCheckedAt`.

**Retry BullMQ** : 3 tentatives avec exponential backoff (500ms / 2s / 8s) **uniquement** sur les erreurs transitoires (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`). Une vraie erreur HTTP 500 n'est PAS retryée — c'est un DOWN légitime. On évite ainsi de noyer les alertes.

### 4. Sécurité — **SSRF, allowlist, isolation worker**

Critique : un MonitorCheck HTTP avec `target = "http://localhost:8080/admin"` permet d'exfiltrer des données internes ou de scanner le réseau. Mitigations :

- **Validation du `target` au CRUD** (avant insert / update) :
  - Schémas autorisés : `http`, `https`, `tcp` (interne), aucun `file://`, `ftp://`, etc.
  - **Bloquer par défaut** : `localhost`, `127.0.0.0/8`, `::1`, `169.254.0.0/16` (link-local), `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
  - **Toggle par tenant** `Tenant.allowInternalMonitorTargets Boolean @default(false)` qui débloque les RFC1918. Réservé à un super-admin via UI dédiée. Justifié pour une infra on-premise qui surveille ses propres équipements LAN — c'est précisément le cas d'usage XCH (chantiers temporaires, équipements souvent en RFC1918). **Le seed pilote pré-active ce toggle** sur le tenant démo (cas d'usage chantiers = LAN partout) ; il reste OFF par défaut pour les déploiements enterprise futurs.
  - Loopback (`127.x`, `::1`) reste **toujours bloqué**, même avec le toggle (un attaquant ne doit jamais pouvoir cibler le worker lui-même).
- **Résolution DNS au probe-time via hook `lookup` natif Node** : revérifier que l'IP résolue n'est pas dans une plage interdite (cas d'un DNS qui pointe vers `127.0.0.1` à l'exécution malgré un nom externe au CRUD). Évite le SSRF par DNS rebinding **par construction** :
  ```ts
  // backend/src/modules/monitoring/probes/safe-lookup.ts
  import { lookup as defaultLookup } from 'dns';
  import { isPrivateOrLoopback } from './target-validator';

  export function makeSafeLookup(allowInternal: boolean) {
    return (hostname: string, options: any, callback: any) => {
      defaultLookup(hostname, options, (err, address, family) => {
        if (err) return callback(err);
        if (isPrivateOrLoopback(address, allowInternal)) {
          return callback(new Error(`SSRF blocked: ${hostname} → ${address}`));
        }
        callback(null, address, family);
      });
    };
  }
  ```
  Passé à `axios` via un `http.Agent({ lookup })` custom et à `net.createConnection({ lookup })`. Node gère SNI / Host header naturellement — on intercepte juste le moment où il transforme le nom en IP. Le hook bloque AVANT que le socket ne s'ouvre, pas de fenêtre TOCTOU.

  Loopback (`127.0.0.0/8`, `::1`) reste bloqué dans `isPrivateOrLoopback` même avec `allowInternal=true`.

  **Alternative considérée et rejetée :** « pin IP au CRUD + re-résolution périodique avec preservation Host header » — ajoute ~60 lignes de gestion d'état (cache, staleness, invalidation), introduit une fenêtre TOCTOU entre la re-résolution et la prochaine probe, et perd les changements DNS légitimes (CDN, IP failover) jusqu'au refresh. Le hook `lookup` natif est plus simple, sans état, sans dette.
- **Timeout court** : 5s par défaut, plafond 30s côté validation (pas de check qui mobilise le worker indéfiniment).
- **Concurrency cap** : BullMQ `concurrency: 20` par défaut. Limite la charge réseau du worker.
- **Worker n'expose aucun port HTTP** : pas de surface d'attaque entrante. Healthcheck via un job BullMQ self-ping (cf. §6).
- **CAP_NET_RAW limité au container worker** : l'API n'a aucune capability réseau étendue.

### 5. API REST — **dans AppModule, pas dans le worker**

| Endpoint | Méthode | Auth | Permissions |
|---|---|---|---|
| `POST /api/monitors` | POST | JWT | `@RequireWrite()` sur le site parent du target |
| `GET /api/monitors` | GET | JWT | `@RequireRead()` ; filtres `?targetType=&targetId=&enabled=` ; scope par délégation auto |
| `GET /api/monitors/:id` | GET | JWT | `@RequireRead()` (héritée du site parent) |
| `PATCH /api/monitors/:id` | PATCH | JWT | `@RequireWrite()` |
| `DELETE /api/monitors/:id` | DELETE | JWT | `@RequireWrite()` |
| `GET /api/monitors/:id/history?limit=50&offset=0&status=` | GET | JWT | `@RequireRead()` ; pagination, ordre desc par `checkedAt` |
| `GET /api/monitors/:id/summary` | GET | JWT | `@RequireRead()` ; renvoie `{ uptime24h, uptime7d, uptime30d, lastResults }` (calcul SQL `COUNT(*) FILTER (WHERE status='UP')::float / COUNT(*)`) |
| `POST /api/monitors/:id/run-now` | POST | JWT | `@RequireWrite()` ; pousse un job BullMQ immédiat, retourne 202 |

Tous les endpoints respectent le scoping délégation standard ([ADR-009](adr-009-delegation-first-model.md)) : filtre automatique par les sites accessibles à l'utilisateur connecté.

### 6. Healthcheck worker

Le worker n'a pas de port HTTP, donc le healthcheck Docker ne peut pas être un `curl`. Trois options évaluées :

- **A** — Pas de healthcheck → docker compose ignore l'état du worker, pas d'alerte si le process se met en zombie. Rejetée.
- **B** — `node -e "process.exit(0)"` → prouve seulement que `node` peut lancer un sous-process. Le process principal peut être vivant mais bloqué (event loop saturé, connexion BullMQ perdue, DB lock) et le check passera quand même au vert. Rejetée (faux négatif garanti).
- **C — (retenue)** Double file-touch : scheduler + self-ping BullMQ.

**Détail option C :**

- **Path :** `/tmp/xch-worker-alive` et `/tmp/xch-worker-consumer-alive` (tmpfs container, pas de volume monté). Ephemeral = un redémarrage container = horodatage propre.
- **Touch principal** par le cron interne `MonitorScheduler` lui-même — chaque tick (30s) il met à jour `/tmp/xch-worker-alive`. Si le scheduler s'arrête, le file devient stale → unhealthy. Couvre le cas « scheduler dead ».
- **Self-ping BullMQ** en complément : toutes les 60s, le scheduler enqueue un job `worker-heartbeat` ; le `MonitorProcessor` le consomme et touche `/tmp/xch-worker-consumer-alive`. Healthcheck vérifie **les deux**. Couvre le cas « scheduler vivant mais consumer décroché de la queue Redis » (le bug le plus vicieux en prod BullMQ).
- **Fenêtre de tolérance :** 60s pour le scheduler (= 2 missed ticks), 120s pour le consumer (= 2 missed self-pings).
- **Healthcheck Docker :**
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "[ $$(($$(date +%s) - $$(stat -c %Y /tmp/xch-worker-alive))) -lt 60 ] && [ $$(($$(date +%s) - $$(stat -c %Y /tmp/xch-worker-consumer-alive))) -lt 120 ]"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 30s
  ```
- **Action en cas de DOWN :** `restart: unless-stopped` + flag unhealthy seulement. **Pas de restart auto sur unhealthy** — risque de boucle restart si la cause sous-jacente est persistante (Redis HS, DB pleine), masque le vrai bug et brûle des CPU. L'unhealthy remonte côté orchestrateur, l'admin investigue. Phase monitoring native ultérieure : on branchera une alerte sur ce signal.

Aucune surface réseau introduite, double-couverture scheduler + consumer.

### 7. Notifications — `MONITOR_DOWN` / `MONITOR_UP` (extension `notification-events.ts`)

Ajout dans `backend/src/modules/notifications/notification-events.ts` :

```ts
MONITOR_DOWN = 'MONITOR_DOWN',
MONITOR_UP = 'MONITOR_UP',
```

avec metas :

```ts
[NotificationEventType.MONITOR_DOWN]: {
  label: 'Monitor en panne',
  description: 'Notification quand un monitor passe à DOWN',
  defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.TEAMS],
  category: 'monitoring',
},
[NotificationEventType.MONITOR_UP]: {
  label: 'Monitor rétabli',
  description: 'Notification quand un monitor revient UP',
  defaultChannels: [NotificationChannel.EMAIL],
  category: 'monitoring',
},
```

Le worker appelle `NotificationService.dispatch({ tenantId, eventType: MONITOR_DOWN, scopeContext: { siteId }, entity: { type: 'monitor', id: check.id, name: check.target }, title, bodyHtml, bodyText, actionUrl: '/dashboard/monitors/'+check.id })`. Le routeur existant résout le `delegationId` depuis le siteId et applique la config héritée — **aucun refactor du routeur n'est nécessaire**.

L'event existant `MONITORING_ALERT` reste utilisé par les webhooks Gatus/Kuma READ-only pour préserver la rétrocompatibilité. **MONITOR_DOWN/MONITOR_UP** sont spécifiques au module natif et permettent à l'utilisateur de configurer indépendamment le comportement (par ex. couper les notifs Kuma sans couper les natives).

### 8. Coexistence avec providers READ-only existants

Le module natif **n'implémente PAS** l'interface `MonitoringProvider` ([backend/src/modules/integrations/interfaces/integration-provider.interface.ts](../../backend/src/modules/integrations/interfaces/integration-provider.interface.ts)) : cette interface modélise un **adaptateur vers un système externe** (`fetchMonitors`, `getMonitorStatus`, `mapToHealthStatus`). Le module natif est un **producteur de checks**, pas un adaptateur.

Les deux coexistent sans conflit :

- **Module natif** : sa propre table `MonitorCheck`, son propre worker, ses propres alertes (`MONITOR_DOWN/UP`).
- **Providers Gatus/Kuma READ-only** : continuent de pull et webhook comme avant, leurs alertes restent sur `MONITORING_ALERT`.

Un site peut avoir les deux à la fois (ex: un client qui a déjà un Gatus en place et qui démarre quelques checks natifs sur de nouveaux assets). **Aucun breaking change**, zéro migration de données existante.

---

## Conséquences

### Positives

- **Source de vérité unique** : les checks vivent dans la base XCH, pilotables 100% par API.
- **Latence zéro** : un toggle UI déclenche un check au prochain tick scheduler (max 30s, vs 5min avec sidecar Gatus).
- **Aucune dépendance externe** : pas de Gatus à maintenir, pas de YAML à syncer, pas de secret machine-to-machine en plus.
- **Schema relationnel propre** : pas de JSON sac-à-tout, intégrité référentielle Postgres, requêtes typées.
- **Sécurité par défaut** : SSRF mitigé au CRUD ET au probe-time, RFC1918 bloqué sauf opt-in tenant.
- **Scalabilité** : un seul `--scale xch-backend-worker=N` suffit pour absorber 10k+ checks.
- **Tests** : probes unit-testables, scheduler testable avec un mock BullMQ, processor testable end-to-end.
- **Cohérence stack** : 100% NestJS + Prisma + BullMQ, comme le reste du projet (warranty, due tasks, audit). Aucune nouvelle techno à apprendre/maintenir.

### Négatives

- **3 nouvelles tables** + 3 nouveaux enums Prisma (acceptable, le schéma est déjà à 50+ modèles).
- **Un nouveau container Docker** (~150 MB image partagée, négligeable).
- **Pas d'UI de gestion globale des MonitorCheck** en v1 — la config est embedded sur la fiche entité (Asset/Site/Link). Une page « Tous les monitors » pourra être ajoutée plus tard si besoin.
- **CAP_NET_RAW** sur le worker : capability privilégiée. Mitigation : worker isolé du réseau public, pas de HTTP entrant, code reviewé.
- **Charge DB** : 500 checks × 1 résultat / 5min = ~150k rows / jour. Acceptable, mais nécessitera un cron de purge **dès la v1** (cf. lot 4).

### Détail purge `MonitorResult`

- **Cron :** `@Cron('0 3 * * *')` — tous les jours à **03:00** (creux d'activité chantiers FR).
- **Stratégie :** `DELETE FROM "MonitorResult" WHERE "checkedAt" < now() - interval '90 days' AND id NOT IN (SELECT MAX(id) FROM "MonitorResult" GROUP BY "checkId")` — préserve **toujours le dernier résultat par check**, même si > 90j (sinon `lastStatus` perd sa cohérence pour un check resté inactif).
- **Batch :** `LIMIT 10000` par itération, boucle jusqu'à 0 row affected. Évite un long lock sur la table en pic.
- **Export/archive avant purge :** **pas en v1** (YAGNI). Le schema reste trivialement extractible si besoin futur (`SELECT * FROM "MonitorResult" WHERE …` → CSV/Parquet). Le jour où un client demande la rétention longue, on ajoutera un champ scalaire `Tenant.monitorResultRetentionDays Int @default(90)` (queryable, pas un settings JSON).

---

## Alternatives considérées

| Option | Pourquoi rejetée |
|---|---|
| **Gatus bidirectionnel via sidecar YAML** ([ADR-012](adr-012-gatus-bidirectional.md)) | Latence 5min, sidecar à maintenir, secret machine-to-machine, dépendance opérationnelle, format YAML fragile aux breaking changes Gatus. |
| **Uptime Kuma bidirectionnel** | Même problème : config UI / DB SQLite locale, pas d'API CRUD propre. |
| **Monolithe (probes dans l'API)** | Crash d'un probe tue l'API. CAP_NET_RAW étendu à l'API entière. Pas de scaling horizontal isolé. |
| **3e repo `xch-monitor` séparé** | Duplication code Prisma/types, complexité CI/CD, maintenance accrue. Aucun bénéfice — l'isolation runtime est déjà obtenue par le 2e container. |
| **JSON `httpConfig` sur MonitorCheck** | Viole [ADR-013](adr-013-residual-json-debt.md) (résorber la dette JSON). Champs non queryables, typage faible. La table 1:0-1 est triviale et propre. |
| **`(targetType, targetId)` polymorphisme string** | Casse l'intégrité référentielle Postgres : suppression d'un Site laisse des MonitorCheck orphelins. FKs séparées + CHECK constraint = même expressivité, sans la dette. |
| **Probes Prometheus Blackbox Exporter** | Très puissant mais externe → revient au problème Gatus (config statique YAML). Aucune raison de l'introduire. |

---

## Plan d'implémentation (9 lots, ~10h, commits atomiques)

| Lot | Titre | Charge | Livrables clés |
|---|---|---|---|
| **1** | Schema Prisma | 30 min | `MonitorCheck`, `MonitorHttpConfig`, `MonitorResult`, enums, relations inverses sur Site/Asset/ConnectivityLink/Tenant. `prisma db push`. |
| **2** | `main.ts` + `WorkerModule` | 45 min | Détection mode `--worker`, bootstrap minimal sans HTTP, sans Auth. `AppModule` inchangé. |
| **3** | Probes + Scheduler + Processor | 3h | `TcpProbe`, `HttpProbe`, `IcmpProbe` + fallback. `MonitorScheduler` (cron 30s). `MonitorProcessor` (BullMQ `monitor-check`, retry 3 backoff). Tests unitaires probes. |
| **4** | API REST CRUD + history + summary + run-now + cron purge | 2h | Controller + Service dans AppModule. Validation SSRF (allowlist scheme + CIDR check). Cron quotidien purge `MonitorResult > 90j`. |
| **5** | docker-compose worker | 30 min | Service `xch-backend-worker` (même image, `--worker`, `cap_add: NET_RAW`, healthcheck file-touch). Dev + prod. |
| **6** | Frontend `<MonitorConfigSection>` | 2h | Composant embedded sur fiches Asset / Site / ConnectivityLink. Toggle, kind, target, port, interval, run-now. |
| **7** | Frontend page historique | 1h | Route `/dashboard/monitors/:id` avec graphe ASCII bars (Tailwind), badges uptime, table paginée. |
| **8** | Notifications `MONITOR_DOWN` / `MONITOR_UP` | 30 min | Extension `notification-events.ts`, intégration dans `MonitorProcessor`. |
| **9** | Deploy + smoke tests | 30 min | Build, reset DB + reseed (2-3 checks démo), curl complet : create → wait result → run-now → simulate down → vérif `UserNotification`. |

**Charge totale : ~10h.** Commits atomiques par lot, push `main` au fil de l'eau, **un seul rebuild backend + frontend à la fin**.

---

## Validation utilisateur (2026-04-26)

Toutes les sous-décisions ci-dessus ont été validées par l'utilisateur :

1. ADR-014 confirmé libre (ADR-013 = JSON debt, ADR-015 = S1 security).
2. Schema 3 tables + FKs polymorphes séparées : OK.
3. `MonitorHttpConfig` 1:0-1, headers en YAGNI : OK.
4. SSRF — RFC1918 bloqué par défaut + toggle tenant ; **toggle pré-activé dans le seed pilote** ; loopback toujours bloqué : OK.
5. `MONITOR_DOWN` / `MONITOR_UP` distincts de `MONITORING_ALERT` : OK.
6. Healthcheck worker : option C enrichie (double file-touch scheduler + self-ping consumer, 60s/120s tolérance, unhealthy flag only sans restart auto) : OK.
7. Purge `MonitorResult` 90j à 03:00, batch 10000, préserve dernier résultat par check : OK.
8. DNS anti-rebinding : hook `lookup` natif Node (option a) plutôt que pin IP : OK.

Implémentation démarrée le 2026-04-26.
