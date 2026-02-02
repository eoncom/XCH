-- Add new provider types and customType field

-- 1. Create new enum with additional types
CREATE TYPE "ProviderType_new" AS ENUM ('TELECOM', 'INTERNET', 'CLOUD', 'HOSTING', 'SECURITY', 'NETWORK', 'MAINTENANCE', 'ENERGY', 'CUSTOM', 'OTHER');

-- 2. Add customType column
ALTER TABLE providers ADD COLUMN IF NOT EXISTS "customType" VARCHAR(50);

-- 3. Migrate existing column to new enum
ALTER TABLE providers ALTER COLUMN type TYPE "ProviderType_new" USING (type::text::"ProviderType_new");

-- 4. Drop old enum and rename new one
DROP TYPE "ProviderType";
ALTER TYPE "ProviderType_new" RENAME TO "ProviderType";
