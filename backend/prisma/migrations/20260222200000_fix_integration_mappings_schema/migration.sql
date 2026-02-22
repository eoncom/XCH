-- Migration: Fix integration_mappings table to match Prisma schema
-- The previous migration created wrong columns. Fix by adding missing and dropping extra ones.

-- Add missing columns
ALTER TABLE "integration_mappings" ADD COLUMN IF NOT EXISTS "externalLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "integration_mappings" ADD COLUMN IF NOT EXISTS "targetType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "integration_mappings" ADD COLUMN IF NOT EXISTS "targetId" TEXT NOT NULL DEFAULT '';

-- Drop columns that don't belong (from incorrect migration)
ALTER TABLE "integration_mappings" DROP COLUMN IF EXISTS "internalId";
ALTER TABLE "integration_mappings" DROP COLUMN IF EXISTS "externalData";
ALTER TABLE "integration_mappings" DROP COLUMN IF EXISTS "lastSyncAt";

-- entityType and provider should be TEXT not VARCHAR
ALTER TABLE "integration_mappings" ALTER COLUMN "provider" TYPE TEXT;
ALTER TABLE "integration_mappings" ALTER COLUMN "entityType" TYPE TEXT;
ALTER TABLE "integration_mappings" ALTER COLUMN "externalId" TYPE TEXT;
