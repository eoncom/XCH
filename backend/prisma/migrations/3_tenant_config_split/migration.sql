-- =============================================================================
-- 3_tenant_config_split — ADR-018 Décision B
--
-- Tenant.config Json? was a 5-objects bag (modules / electricity / appearance /
-- branding / sso, plus a securityReminders list under branding). We split into
-- 5 typed 1:0..1 (or 1:N) tables + a TenantSecurityReminder typed table with
-- optional site scope and severity. User.appearancePreference also split into
-- 3 scalar columns.
-- =============================================================================

-- 1. Enums + tables --------------------------------------------------------

CREATE TYPE "SecurityReminderSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TABLE "tenant_feature_flags" (
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_feature_flags_pkey" PRIMARY KEY ("tenantId", "name"),
  CONSTRAINT "tenant_feature_flags_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tenant_electricity_configs" (
  "tenantId"   TEXT NOT NULL PRIMARY KEY,
  "costPerKwh" DECIMAL(10, 4) NOT NULL DEFAULT 0.20,
  "currency"   TEXT NOT NULL DEFAULT 'EUR',
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_electricity_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tenant_appearance_configs" (
  "tenantId"          TEXT NOT NULL PRIMARY KEY,
  "theme"             TEXT NOT NULL DEFAULT 'light',
  "primaryColor"      TEXT NOT NULL DEFAULT '#0070f3',
  "density"           TEXT NOT NULL DEFAULT 'comfortable',
  "allowUserOverride" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_appearance_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tenant_branding_configs" (
  "tenantId"         TEXT NOT NULL PRIMARY KEY,
  "logoUrl"          TEXT,
  "primaryColor"     TEXT,
  "secondaryColor"   TEXT,
  "accentColor"      TEXT,
  "organizationName" TEXT,
  "theme"            TEXT,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_branding_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tenant_sso_configs" (
  "tenantId"     TEXT NOT NULL PRIMARY KEY,
  "provider"     TEXT NOT NULL,
  "clientId"     TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "issuerUrl"    TEXT,
  "callbackUrl"  TEXT,
  "scopes"       TEXT,
  "groupClaim"   TEXT,
  "roleMapping"  JSONB,
  "enabled"      BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_sso_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tenant_security_configs" (
  "tenantId"             TEXT NOT NULL PRIMARY KEY,
  "require2FA"           BOOLEAN NOT NULL DEFAULT false,
  "sessionTimeout"       TEXT NOT NULL DEFAULT '15m',
  "refreshTokenLifetime" TEXT NOT NULL DEFAULT '7d',
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_security_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tenant_integration_configs" (
  "tenantId"    TEXT NOT NULL PRIMARY KEY,
  "netboxUrl"   TEXT,
  "netboxToken" TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_integration_configs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tenant_security_reminders" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "siteId"    TEXT,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "severity"  "SecurityReminderSeverity" NOT NULL DEFAULT 'INFO',
  "category"  TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_security_reminders_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tenant_security_reminders_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "tenant_security_reminders_tenantId_idx" ON "tenant_security_reminders"("tenantId");
CREATE INDEX "tenant_security_reminders_tenantId_siteId_idx" ON "tenant_security_reminders"("tenantId", "siteId");

-- 2. Data migration from Tenant.config -------------------------------------

-- Feature flags: jsonb_each_text on config.modules (Record<string, boolean>)
INSERT INTO "tenant_feature_flags" ("tenantId", "name", "enabled", "updatedAt")
SELECT t.id, kv.key, (kv.value)::boolean, NOW()
FROM "tenants" t,
     jsonb_each_text(COALESCE(t.config -> 'modules', '{}'::jsonb)) AS kv
WHERE t.config -> 'modules' IS NOT NULL;

-- Electricity
INSERT INTO "tenant_electricity_configs" ("tenantId", "costPerKwh", "currency", "updatedAt")
SELECT
  id,
  COALESCE((config -> 'electricity' ->> 'costPerKwh')::numeric, 0.20),
  COALESCE(config -> 'electricity' ->> 'currency', 'EUR'),
  NOW()
FROM "tenants"
WHERE config -> 'electricity' IS NOT NULL;

-- Appearance
INSERT INTO "tenant_appearance_configs" ("tenantId", "theme", "primaryColor", "density", "allowUserOverride", "updatedAt")
SELECT
  id,
  COALESCE(config -> 'appearance' ->> 'theme',        'light'),
  COALESCE(config -> 'appearance' ->> 'primaryColor', '#0070f3'),
  COALESCE(config -> 'appearance' ->> 'density',      'comfortable'),
  COALESCE((config -> 'appearance' ->> 'allowUserOverride')::boolean, true),
  NOW()
FROM "tenants"
WHERE config -> 'appearance' IS NOT NULL;

-- Branding (legacy may write theme either at root or inside branding)
INSERT INTO "tenant_branding_configs" ("tenantId", "logoUrl", "primaryColor", "secondaryColor", "accentColor", "organizationName", "theme", "updatedAt")
SELECT
  id,
  NULLIF(config -> 'branding' ->> 'logoUrl',          ''),
  NULLIF(config -> 'branding' ->> 'primaryColor',     ''),
  NULLIF(config -> 'branding' ->> 'secondaryColor',   ''),
  NULLIF(config -> 'branding' ->> 'accentColor',      ''),
  NULLIF(config -> 'branding' ->> 'organizationName', ''),
  NULLIF(COALESCE(config -> 'branding' ->> 'theme', config ->> 'theme'), ''),
  NOW()
FROM "tenants"
WHERE config -> 'branding' IS NOT NULL OR (config ? 'theme');

-- SSO (note: legacy field was 'issuer', new column is 'issuerUrl')
INSERT INTO "tenant_sso_configs" ("tenantId", "provider", "clientId", "clientSecret", "issuerUrl", "callbackUrl", "scopes", "groupClaim", "roleMapping", "enabled", "updatedAt")
SELECT
  id,
  COALESCE(config -> 'sso' ->> 'provider',     'oidc'),
  COALESCE(config -> 'sso' ->> 'clientId',     ''),
  COALESCE(config -> 'sso' ->> 'clientSecret', ''),
  NULLIF(COALESCE(config -> 'sso' ->> 'issuerUrl', config -> 'sso' ->> 'issuer'), ''),
  NULLIF(config -> 'sso' ->> 'callbackUrl', ''),
  NULLIF(config -> 'sso' ->> 'scopes',      ''),
  NULLIF(config -> 'sso' ->> 'groupClaim',  ''),
  config -> 'sso' -> 'roleMapping',
  COALESCE((config -> 'sso' ->> 'enabled')::boolean, false),
  NOW()
FROM "tenants"
WHERE config -> 'sso' IS NOT NULL;

-- Security
INSERT INTO "tenant_security_configs" ("tenantId", "require2FA", "sessionTimeout", "refreshTokenLifetime", "updatedAt")
SELECT
  id,
  COALESCE((config -> 'security' ->> 'require2FA')::boolean, false),
  COALESCE(config -> 'security' ->> 'sessionTimeout',       '15m'),
  COALESCE(config -> 'security' ->> 'refreshTokenLifetime', '7d'),
  NOW()
FROM "tenants"
WHERE config -> 'security' IS NOT NULL;

-- Integrations (NetBox only post-ADR-016)
INSERT INTO "tenant_integration_configs" ("tenantId", "netboxUrl", "netboxToken", "updatedAt")
SELECT
  id,
  NULLIF(config -> 'integrations' -> 'netbox' ->> 'url',   ''),
  NULLIF(config -> 'integrations' -> 'netbox' ->> 'token', ''),
  NOW()
FROM "tenants"
WHERE config -> 'integrations' IS NOT NULL;

-- Security reminders (was branding.securityReminders JSON-list)
INSERT INTO "tenant_security_reminders" ("id", "tenantId", "title", "body", "severity", "order", "enabled", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t.id,
  COALESCE(NULLIF(arr.r ->> 'title', ''), '(sans titre)'),
  COALESCE(arr.r ->> 'body', ''),
  'INFO'::"SecurityReminderSeverity",
  (arr.ord - 1)::int,
  true,
  NOW(),
  NOW()
FROM "tenants" t,
     jsonb_array_elements(COALESCE(t.config -> 'branding' -> 'securityReminders', '[]'::jsonb))
       WITH ORDINALITY AS arr(r, ord)
WHERE t.config -> 'branding' -> 'securityReminders' IS NOT NULL
  AND jsonb_array_length(t.config -> 'branding' -> 'securityReminders') > 0;

-- 3. User.appearancePreference → 3 scalar columns -------------------------

ALTER TABLE "users"
  ADD COLUMN "appearanceTheme"        TEXT,
  ADD COLUMN "appearancePrimaryColor" TEXT,
  ADD COLUMN "appearanceDensity"      TEXT;

UPDATE "users" SET
  "appearanceTheme"        = NULLIF("appearancePreference"->>'theme', ''),
  "appearancePrimaryColor" = NULLIF("appearancePreference"->>'primaryColor', ''),
  "appearanceDensity"      = NULLIF("appearancePreference"->>'density', '')
WHERE "appearancePreference" IS NOT NULL;

ALTER TABLE "users" DROP COLUMN "appearancePreference";

-- 4. Drop Tenant.config ----------------------------------------------------

ALTER TABLE "tenants" DROP COLUMN "config";
