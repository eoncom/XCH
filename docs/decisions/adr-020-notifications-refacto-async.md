# ADR-020 : Refacto NotificationConfig (split JSON → 2 tables typées) + bascule async via Worker BullMQ

Date : 2026-04-29
Statut : Accepté
Tag cible : v1.7.0 (Session 3 du plan finalization v2)
Dépendances :
- ADR-018 (split JSON résiduel — pattern de référence pour migration data)
- ADR-019 (chiffrement at-rest, `CryptoService` injectable global)

## Contexte

Le module Notifications hérité de v1.4.x présente trois dettes :

### 1. Stockage JSON sac-à-tout

`NotificationConfig` est une seule table (tenantId, delegationId, channels JSONB,
events JSONB) qui mélange :

- 2 channels (`email`, `teams`) avec leurs configs (recipients, webhookUrl, enabled).
- 8 event types (`TASK_ASSIGNED`, `MONITOR_DOWN`, …) avec leurs channel-bindings.

Conséquences :
- Pas type-safe (le frontend manipule `(config.channels as any).email.recipients`).
- Pas indexable (impossible de filtrer "tous les tenants qui ont teams.enabled").
- Walker `ENCRYPTED_CHANNEL_PATHS = ['teams.webhookUrl']` introduit en Session 2
  pour chiffrer 1 sub-field — fragile (si on rename la clé JSON, le walker rate
  silencieusement le secret).
- Inheritance gérée par `inherit: true` flags noyés dans le JSON, lus par 2-3
  helpers privés du service.

### 2. Envoi 100% synchrone

`NotificationService.dispatch()` fait `await channel.send()` direct pour chaque
channel cible. Le `Promise.all().catch()` empêche la chaîne d'exception, mais
chaque caller (tasks, assets, sites, monitoring, auth) bloque sur le RTT réseau
SMTP / Teams. Si Outlook répond en 4 s, l'API XCH bloque 4 s aussi.

Pas de retry, pas de backoff, pas de DLQ. Un Teams webhook qui répond 503
perd la notification définitivement.

### 3. BullMQ déjà branché mais inutilisé pour notifs

`BullModule.forRoot` est posé dans `app.module.ts` et utilisé par `monitoring`
(queue `monitor-check` + `MonitorProcessor`). Pattern propre et imitable —
mais `NotificationsModule` ne l'importe même pas.

## Décision

### A. Schéma cible : 2 tables Prisma typées (pas 3 — pas de Digest)

```prisma
enum NotificationChannelKind {
  EMAIL
  TEAMS
}

enum NotificationEventType {
  TASK_ASSIGNED
  TASK_STATUS_CHANGED
  SITE_STATUS_CHANGED
  ASSET_CRITICAL
  MONITOR_DOWN
  MONITOR_UP
  USER_INVITED
  PASSWORD_RESET
}

model NotificationChannel {
  id           String                  @id @default(cuid())
  tenantId     String
  tenant       Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  delegationId String?
  delegation   Delegation?             @relation(fields: [delegationId], references: [id], onDelete: Cascade)
  kind         NotificationChannelKind
  enabled      Boolean                 @default(true)
  recipients   String[]                @default([])  // for EMAIL
  webhookUrl   String?                 // for TEAMS — encrypted-at-rest (ADR-019)
  config       Json?                   @db.JsonB     // non-sensitive options only
  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  @@unique([tenantId, delegationId, kind])
  @@index([tenantId])
  @@map("notification_channels")
}

model NotificationRule {
  id           String                      @id @default(cuid())
  tenantId     String
  tenant       Tenant                      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  delegationId String?
  delegation   Delegation?                 @relation(fields: [delegationId], references: [id], onDelete: Cascade)
  eventType    NotificationEventType
  channels     NotificationChannelKind[]   @default([])
  enabled      Boolean                     @default(true)
  createdAt    DateTime                    @default(now())
  updatedAt    DateTime                    @updatedAt

  @@unique([tenantId, delegationId, eventType])
  @@index([tenantId, eventType])
  @@map("notification_rules")
}
```

#### Pourquoi pas `NotificationDigest`

Aucun digest cron n'existe aujourd'hui (audit 2026-04-29). Le warranty cron
(`UserNotificationService` → `EVERY_DAY_AT_8AM`) écrit en `UserNotification`
in-app — pas un digest external email/Teams.

YAGNI. Si un client demande des digests un jour, on rouvrira un ADR dédié
avec les vrais besoins (granularité, formats, opt-out, throttling).

#### Inheritance simplifiée

Plus de flag `inherit: true` dans le JSON. **Convention** :
- Une rule pour `(tenantId, delegationId, eventType)` override.
- Si pas de row spécifique, on retombe sur `(tenantId, NULL, eventType)` (global).
- Si pas de row global non plus, on prend le défaut de `NOTIFICATION_EVENTS[eventType].defaultChannels`.

Idem pour `NotificationChannel` : delegation > global > pas de row → channel
disabled.

`resolveConfig()` devient une simple requête + `mergeBy(eventType)`. Plus de
walker récursif, plus de helper `inheritAllChannels`.

### B. Règle architecturale post-ADR-019/020 : `config_json` ne contient JAMAIS de secret

> **`config_json` ne contient que du non-sensible** (formatage, options
> d'affichage, champs typés futurs avant migration scalaire). Tout secret
> passe en colonne scalaire chiffrée via `CryptoService.encryptIfPlain` /
> `decryptOrLegacy`.

Conséquences :
- Le walker `encryptSubfields` / `decryptSubfields` / `ENCRYPTED_CHANNEL_PATHS`
  introduit en Session 2 (ADR-019 §5.4) **est retiré** — il n'a plus de cible
  (le seul utilisateur était `teams.webhookUrl`, désormais colonne scalaire).
- Pour les futurs channels (Slack, Discord, Pagerduty, …), même règle : le
  `webhookUrl` / `apiToken` / `secret` est une colonne scalaire chiffrée, pas
  un sub-field JSON.
- Pattern unique pour tout le projet → debug trivial (un secret = une colonne
  préfixée `v1:` au SELECT).

### C. Worker BullMQ générique

```
                        ┌───────────────────────────┐
[caller dispatch] ─────▶│  notifications queue       │
                        │   job: { eventType,        │
                        │         tenantId,          │
                        │         delegationId?,     │
                        │         payload }          │
                        └───────────┬───────────────┘
                                    │
                                    ▼
                        ┌───────────────────────────┐
                        │  NotificationProcessor    │
                        │  - resolveRule()          │
                        │  - resolveChannels()      │
                        │  - fan-out → N sub-jobs   │
                        └───────────┬───────────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  ▼                 ▼                 ▼
            EmailChannel      TeamsChannel      (future Slack)
            transporter       axios + SSRF
            sendMail          checks
```

Décisions Worker :
- Queue unique `notifications` (pas une queue par channel — single ordering
  + 1 processor concentre la logique de résolution).
- Job `notification-dispatch` (job principal) → `NotificationProcessor` lit
  les rules, instancie les channels, **await en parallèle dans le même job**
  (Promise.all). Pas de fan-out en sub-jobs : la complexité ne le justifie
  pas (≤2 channels par event aujourd'hui).
- Retry : 3 tentatives, backoff exponentiel (1s, 5s, 30s). BullMQ default
  expanded.
- Failed jobs → restent dans `failed` set BullMQ (visible dans Bull
  dashboard si on l'ajoute plus tard ; pas de DLQ explicite pour la phase
  pilote).
- `NotificationLog` row écrite par le processor (pas par le caller) —
  source de vérité unique de "qui a envoyé quoi quand".

Le caller change de `await this.notif.dispatch(payload)` à
`await this.notif.queueDispatch(payload)` (renvoie après ~1ms — le `add`
sur Redis).

### D. API contract — breaking, frontend adapté en même temps

`GET /api/notifications/config?delegationId=…` renvoie désormais :

```json
{
  "scope": { "tenantId": "...", "delegationId": null | "..." },
  "channels": [
    { "kind": "EMAIL", "enabled": true, "recipients": ["..."], "webhookUrl": null },
    { "kind": "TEAMS", "enabled": false, "recipients": [], "webhookUrl": "..." }
  ],
  "rules": [
    { "eventType": "TASK_ASSIGNED", "enabled": true, "channels": ["EMAIL"] },
    ...
  ],
  "isDefault": false
}
```

`PUT /api/notifications/config` reçoit la même shape ; transaction Prisma
qui upsert les channels + upsert les rules (1 round-trip, atomique).

`GET /api/notifications/config/resolved` retourne la résolution effective
post-héritage (pour debug UI).

`GET /api/notifications/meta`, `POST /api/notifications/test`,
`GET /api/notifications/logs` inchangés.

DTO adapter rejeté pour rester cohérent avec `XCH_DEMO_DATA_PRINCIPLE` :
on casse pour mieux construire, le frontend bouge en même temps.

### E. Migration data : `6_notifications_split` versionnée

Étapes Prisma migration :
1. `CREATE TYPE notification_channel_kind AS ENUM ('EMAIL', 'TEAMS')`.
2. `CREATE TYPE notification_event_type AS ENUM (8 valeurs)`.
3. `CREATE TABLE notification_channels` + `notification_rules`.
4. `INSERT INTO notification_channels SELECT ... FROM notification_configs`
   en parsant le JSON :
   - 1 row EMAIL par config (recipients dérivés de `channels->'email'->'recipients'`).
   - 1 row TEAMS par config (webhookUrl dérivé de `channels->'teams'->'webhookUrl'`).
5. `INSERT INTO notification_rules SELECT ... FROM notification_configs`
   en explosant le JSON `events` (jsonb_each) :
   - 1 row par (tenantId, delegationId, eventType).
6. `DROP TABLE notification_configs` (plus de raison d'exister).

Cohérent avec le pattern ADR-018 (migrations 2-5).

**Note ADR-019** : si le `webhookUrl` historique était chiffré (`v1:…`), il
est inséré tel quel dans la nouvelle colonne — `decryptOrLegacy` côté lecture
le décrypte. Pas de re-chiffrement nécessaire à la migration.

### F. Fichiers touchés (estimation)

Backend (~12-13 fichiers) :
- `prisma/schema.prisma` — enums + 2 tables, suppression NotificationConfig.
- `prisma/migrations/6_notifications_split/migration.sql`.
- `src/modules/notifications/notification-events.ts` — alignement enum.
- `src/modules/notifications/notification-config.service.ts` → renommé
  `notification-settings.service.ts` (CRUD channels + rules).
- `src/modules/notifications/notification.service.ts` — `dispatch()` devient
  `queueDispatch()`.
- `src/modules/notifications/notification.processor.ts` — **nouveau**, le worker.
- `src/modules/notifications/dto/save-notification-config.dto.ts` — nouveau shape.
- `src/modules/notifications/notification.controller.ts` — endpoints adaptés.
- `src/modules/notifications/notifications.module.ts` — registerQueue + processor.
- `src/modules/notifications/channels/email.channel.ts` — signature simplifiée.
- `src/modules/notifications/channels/teams.channel.ts` — decrypt scalar webhookUrl.
- `src/modules/notifications/channels/notification-channel.interface.ts` — shape.
- 5 callers à mettre à jour (`tasks`, `assets`, `sites`, `monitoring`, `auth`)
  → `await dispatch(...)` → `queueDispatch(...)`.

Frontend (~3 fichiers) :
- `frontend/src/lib/api/notifications.ts` — types + méthodes.
- `frontend/src/app/dashboard/settings/notifications/NotificationsConfigPanel.tsx` — refacto UI.
- `frontend/src/app/dashboard/settings/notifications/page.tsx` — wrapper minimal.

Seed :
- `backend/src/modules/seed/seed.service.ts` — démo crée 1 config global
  + override delegation, à mettre au nouveau format.

Tests :
- `notification.processor.spec.ts` (nouveau) — résolution rule, fan-out, retry.
- `notification-settings.service.spec.ts` (nouveau) — CRUD + inheritance.

## Conséquences

### Positives
- Schéma type-safe end-to-end. Plus de `(x as any).y`.
- Indexable : on peut filtrer "tenants avec Teams enabled" en SQL pur.
- `webhookUrl` chiffré comme tout autre secret (cohérence ADR-019).
- Walker JSON sub-field retiré → 1 pattern unique pour tout le chiffrement
  at-rest XCH.
- Send async : les callers ne bloquent plus sur SMTP / Teams. La latence
  d'API XCH n'est plus polluée par le réseau externe.
- Retry intégré : un Teams webhook qui répond 503 est retenté 3× avec
  backoff. Plus de notifications perdues silencieusement.
- Pattern `monitor-check` reproduit fidèlement → onboarding dev simple.

### Négatives (acceptées)
- Migration Prisma irréversible (DROP TABLE). Reset+seed sur xch-deploy
  (DEMO_DATA_PRINCIPLE — accepté).
- 5 callers à modifier. Surface limitée mais non nulle.
- Frontend refondu (3 fichiers). PR coordonnée backend + frontend.
- Worker introduit un délai de ~50-200 ms entre le caller et l'envoi
  effectif (acceptable — non-blocking pour l'utilisateur).

### Forward dependency : Session 5 (drift doc final)
- CHANGELOG, README, INSTALL_PROD à mettre à jour pour refléter le
  nouveau modèle de notifications.
- Les diagrammes archi (s'il y en a dans `docs/architecture/`) doivent
  pointer vers la nouvelle queue `notifications`.

## Alternatives considérées

1. **Garder `NotificationConfig` + `inherit: true`** — rejeté. Dette
   technique acceptée pour 6 mois ne se résorbera pas seule. Cohérence
   avec ADR-018 qui a fait pareil pour Tenant.config.

2. **3 tables (Channel + Rule + Digest)** — rejeté pour YAGNI. Le digest
   cron n'a pas d'usage actuel. Ouvrir un ADR dédié quand le besoin
   client se matérialise.

3. **Wrapper Prisma transparent pour le chiffrement webhookUrl** —
   rejeté (cohérent avec ADR-019 §3 — invocation explicite).

4. **DTO adapter qui garde l'ancien shape API** — rejeté pour ne pas
   maintenir 2 surfaces. DEMO_DATA_PRINCIPLE permet le breaking.

5. **Queue par channel** (`email-queue`, `teams-queue`) — rejeté. Une
   queue avec un processor centralisé garde la résolution de rule
   (lookup DB) en un seul endroit.

6. **Fan-out en sub-jobs** (1 job par channel à envoyer) — rejeté. Pour
   ≤2 channels par event, `Promise.all` dans le même job suffit ; éviter
   la complexité du tracking inter-job.

7. **Retry custom dans le processor** — rejeté. BullMQ retry default
   couvre 99% des cas avec 0 ligne de code custom.

## Plan d'exécution

1. ADR-020 (ce document).
2. Schéma Prisma + migration `6_notifications_split` (CREATE + INSERT
   FROM JSON + DROP).
3. Backend : refonte service / controller / DTOs / processor / module.
4. Backend : adaptation des 5 callers (`queueDispatch` au lieu de
   `dispatch`).
5. Suppression du walker `ENCRYPTED_CHANNEL_PATHS` (ADR-019 §5.4).
6. Seed démo adapté (1 channel EMAIL global, 1 channel TEAMS global, 8
   rules par défaut).
7. Frontend : types + API client + panel refondu.
8. Tests Jest : processor + settings service.
9. Bump v1.6.2 → v1.7.0 + commit + tag + smoke prod (reset+seed +
   send notification de test + vérification log + vérification
   chiffrement webhookUrl).
