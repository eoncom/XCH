-- Fix asset_movements table schema to match Prisma model
-- Corrects column names, enum values, FK constraints, and indexes

-- ============================================================================
-- 1. Rename columns to match Prisma schema
-- ============================================================================
ALTER TABLE "asset_movements" RENAME COLUMN "fromPosition" TO "fromRackPositionU";
ALTER TABLE "asset_movements" RENAME COLUMN "toPosition" TO "toRackPositionU";
ALTER TABLE "asset_movements" RENAME COLUMN "createdAt" TO "timestamp";

-- ============================================================================
-- 2. Change fromStatus/toStatus from AssetStatus enum to TEXT
-- ============================================================================
ALTER TABLE "asset_movements" ALTER COLUMN "fromStatus" TYPE TEXT;
ALTER TABLE "asset_movements" ALTER COLUMN "toStatus" TYPE TEXT;

-- ============================================================================
-- 3. Add missing enum values to AssetMovementType
-- ============================================================================
-- Note: SITE_TRANSFER exists in DB but schema expects SITE_CHANGE
-- We add the missing values; SITE_TRANSFER will remain but won't conflict
ALTER TYPE "AssetMovementType" ADD VALUE IF NOT EXISTS 'SITE_CHANGE';
ALTER TYPE "AssetMovementType" ADD VALUE IF NOT EXISTS 'RACK_MOUNT';
ALTER TYPE "AssetMovementType" ADD VALUE IF NOT EXISTS 'RACK_UNMOUNT';
ALTER TYPE "AssetMovementType" ADD VALUE IF NOT EXISTS 'RACK_MOVE';

-- ============================================================================
-- 4. Add missing foreign key constraints
-- ============================================================================
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_fromSiteId_fkey"
  FOREIGN KEY ("fromSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_toSiteId_fkey"
  FOREIGN KEY ("toSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_fromRackId_fkey"
  FOREIGN KEY ("fromRackId") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_toRackId_fkey"
  FOREIGN KEY ("toRackId") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 5. Fix indexes (drop old, create composite)
-- ============================================================================
DROP INDEX IF EXISTS "asset_movements_assetId_idx";
DROP INDEX IF EXISTS "asset_movements_tenantId_idx";

CREATE INDEX "asset_movements_tenantId_assetId_idx" ON "asset_movements"("tenantId", "assetId");
CREATE INDEX "asset_movements_assetId_timestamp_idx" ON "asset_movements"("assetId", "timestamp");
