-- Unify WIFI_AP / ACCESS_POINT: add WIFI_AP to PinType, migrate data, remove ACCESS_POINT

-- Add WIFI_AP to PinType enum (if not already present)
ALTER TYPE "PinType" ADD VALUE IF NOT EXISTS 'WIFI_AP';

-- Migrate existing data
UPDATE "pins" SET "pinType" = 'WIFI_AP' WHERE "pinType" = 'ACCESS_POINT';
UPDATE "assets" SET "type" = 'WIFI_AP' WHERE "type" = 'ACCESS_POINT';

-- Note: PostgreSQL does not support removing enum values.
-- ACCESS_POINT remains in the DB enum but is no longer used by Prisma or application code.
-- It will be ignored at runtime.
