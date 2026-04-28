-- =============================================================================
-- 2_asset_network_info_split — ADR-018 Décision A
--
-- Split Asset.networkInfo Json? into:
--   - 5 scalar columns on Asset: ip, mac, hostname, vlan, port (queryable, indexable)
--   - new table AssetAdminLink (1:N) for the formerly nested adminLinks list
--
-- Data migration via UPDATE (scalars) + INSERT FROM jsonb_array_elements (links)
-- BEFORE the Asset.networkInfo column is dropped.
-- =============================================================================

-- 1. Add scalar columns
ALTER TABLE "assets"
  ADD COLUMN "ip"       TEXT,
  ADD COLUMN "mac"      TEXT,
  ADD COLUMN "hostname" TEXT,
  ADD COLUMN "vlan"     TEXT,
  ADD COLUMN "port"     TEXT;

-- 2. Migrate scalar fields from networkInfo JSON
UPDATE "assets" SET
  "ip"       = NULLIF("networkInfo"->>'ip', ''),
  "mac"      = NULLIF("networkInfo"->>'mac', ''),
  "hostname" = NULLIF("networkInfo"->>'hostname', ''),
  "vlan"     = NULLIF("networkInfo"->>'vlan', ''),
  "port"     = NULLIF("networkInfo"->>'port', '')
WHERE "networkInfo" IS NOT NULL;

-- 3. Index for IP-based lookups (partial index, only non-null)
CREATE INDEX "assets_tenantId_ip_idx" ON "assets"("tenantId", "ip") WHERE "ip" IS NOT NULL;

-- 4. AssetAdminLink table
CREATE TABLE "asset_admin_links" (
  "id"        TEXT NOT NULL,
  "assetId"   TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asset_admin_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asset_admin_links_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "asset_admin_links_assetId_idx" ON "asset_admin_links"("assetId");

-- 5. Migrate adminLinks JSON-list rows into the new table.
-- Generate cuid-like ids via gen_random_uuid (extension pgcrypto is not
-- guaranteed; use ::text on a UUID for a unique key — Prisma's @id @default(cuid())
-- only kicks in for INSERTs from the app layer, not from raw SQL).
INSERT INTO "asset_admin_links" ("id", "assetId", "label", "url", "order", "createdAt")
SELECT
  gen_random_uuid()::text,
  a.id,
  l->>'label',
  l->>'url',
  (ord - 1)::int,
  NOW()
FROM "assets" a,
     jsonb_array_elements(COALESCE(a."networkInfo"->'adminLinks', '[]'::jsonb))
       WITH ORDINALITY AS arr(l, ord)
WHERE a."networkInfo" -> 'adminLinks' IS NOT NULL
  AND jsonb_array_length(a."networkInfo"->'adminLinks') > 0
  AND COALESCE(l->>'label', '') <> ''
  AND COALESCE(l->>'url',   '') <> '';

-- 6. Drop the old networkInfo JSON column
ALTER TABLE "assets" DROP COLUMN "networkInfo";
