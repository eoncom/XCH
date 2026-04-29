-- =============================================================================
-- 6_notifications_split — ADR-020
--
-- NotificationConfig (1 table, 2 JSON columns) → 2 typed tables :
--   - notification_channels (per kind: EMAIL, TEAMS) with scalar webhookUrl
--     (encrypted-at-rest via CryptoService — ADR-019 pattern preserved)
--   - notification_rules (per eventType) with channels enum array
--
-- Inheritance pattern unchanged : delegationId=NULL row is the global,
-- delegationId<>NULL rows override per-delegation.
--
-- Migration is destructive — DROPs notification_configs at the end.
-- xch-deploy is demo data only (XCH_DEMO_DATA_PRINCIPLE), reset+seed
-- is the reference operation post-deploy.
-- =============================================================================

-- 1. Enums --------------------------------------------------------------------

CREATE TYPE "NotificationChannelKind" AS ENUM ('EMAIL', 'TEAMS');

CREATE TYPE "NotificationEventType" AS ENUM (
  'TASK_ASSIGNED',
  'TASK_STATUS_CHANGED',
  'SITE_STATUS_CHANGED',
  'ASSET_CRITICAL',
  'MONITOR_DOWN',
  'MONITOR_UP',
  'USER_INVITED',
  'PASSWORD_RESET'
);

-- 2. notification_channels ---------------------------------------------------

CREATE TABLE "notification_channels" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "delegationId" TEXT,
  "kind"         "NotificationChannelKind" NOT NULL,
  "enabled"      BOOLEAN NOT NULL DEFAULT true,
  "recipients"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "webhookUrl"   TEXT,
  "config"       JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_channels_tenantId_delegationId_kind_key"
  ON "notification_channels" ("tenantId", "delegationId", "kind");

CREATE INDEX "notification_channels_tenantId_idx"
  ON "notification_channels" ("tenantId");

ALTER TABLE "notification_channels"
  ADD CONSTRAINT "notification_channels_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_channels"
  ADD CONSTRAINT "notification_channels_delegationId_fkey"
  FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. notification_rules ------------------------------------------------------

CREATE TABLE "notification_rules" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "delegationId" TEXT,
  "eventType"    "NotificationEventType" NOT NULL,
  "channels"     "NotificationChannelKind"[] NOT NULL DEFAULT ARRAY[]::"NotificationChannelKind"[],
  "enabled"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_rules_tenantId_delegationId_eventType_key"
  ON "notification_rules" ("tenantId", "delegationId", "eventType");

CREATE INDEX "notification_rules_tenantId_eventType_idx"
  ON "notification_rules" ("tenantId", "eventType");

ALTER TABLE "notification_rules"
  ADD CONSTRAINT "notification_rules_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_rules"
  ADD CONSTRAINT "notification_rules_delegationId_fkey"
  FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Data migration from notification_configs ---------------------------------
-- For each NotificationConfig row, emit :
--   - 1 EMAIL channel row if channels.email is present
--   - 1 TEAMS channel row if channels.teams is present
--   - 1 rule row per (config, event) where events[event].inherit is not true
-- (inherit=true means "no override at this scope" → no row, fall through to
-- defaults at runtime).

INSERT INTO "notification_channels"
  ("id", "tenantId", "delegationId", "kind", "enabled", "recipients", "webhookUrl", "config", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  nc."tenantId",
  nc."delegationId",
  'EMAIL'::"NotificationChannelKind",
  COALESCE((nc.channels->'email'->>'enabled')::boolean, true),
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(nc.channels->'email'->'recipients')),
    ARRAY[]::TEXT[]
  ),
  NULL,
  NULL,
  COALESCE(nc."createdAt", NOW()),
  NOW()
FROM "notification_configs" nc
WHERE nc.channels ? 'email'
  AND COALESCE((nc.channels->'email'->>'inherit')::boolean, false) = false;

INSERT INTO "notification_channels"
  ("id", "tenantId", "delegationId", "kind", "enabled", "recipients", "webhookUrl", "config", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  nc."tenantId",
  nc."delegationId",
  'TEAMS'::"NotificationChannelKind",
  COALESCE((nc.channels->'teams'->>'enabled')::boolean, false),
  ARRAY[]::TEXT[],
  NULLIF(nc.channels->'teams'->>'webhookUrl', ''),
  NULL,
  COALESCE(nc."createdAt", NOW()),
  NOW()
FROM "notification_configs" nc
WHERE nc.channels ? 'teams'
  AND COALESCE((nc.channels->'teams'->>'inherit')::boolean, false) = false;

-- Rules : explode events JSON object — one row per (tenant, delegation, eventType)
-- where the event is not inheriting. The channels array is reconstructed from
-- the JSON ['email','teams'] (lowercase) → enum['EMAIL','TEAMS'] (uppercase).

INSERT INTO "notification_rules"
  ("id", "tenantId", "delegationId", "eventType", "channels", "enabled", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  nc."tenantId",
  nc."delegationId",
  ev.key::"NotificationEventType",
  COALESCE(
    (
      SELECT ARRAY_AGG(UPPER(c)::"NotificationChannelKind")
      FROM jsonb_array_elements_text(ev.value->'channels') AS c
      WHERE UPPER(c) IN ('EMAIL', 'TEAMS')
    ),
    ARRAY[]::"NotificationChannelKind"[]
  ),
  COALESCE((ev.value->>'enabled')::boolean, true),
  COALESCE(nc."createdAt", NOW()),
  NOW()
FROM "notification_configs" nc,
     jsonb_each(nc.events) AS ev(key, value)
WHERE COALESCE((ev.value->>'inherit')::boolean, false) = false
  -- Skip events not in our enum (defensive : ignore unknown legacy keys).
  AND ev.key IN (
    'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'SITE_STATUS_CHANGED',
    'ASSET_CRITICAL', 'MONITOR_DOWN', 'MONITOR_UP',
    'USER_INVITED', 'PASSWORD_RESET'
  );

-- 5. Drop legacy table -------------------------------------------------------

DROP TABLE "notification_configs";
