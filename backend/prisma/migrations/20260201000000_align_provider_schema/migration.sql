-- Migration: Align Provider schema with frontend expectations
-- Date: 2026-02-01
-- Changes:
--   1. Replace enum ProviderType (CABLING, OPERATOR, INTEGRATOR, MAINTENANCE, OTHER)
--      with (TELECOM, INTERNET, CLOUD, HOSTING, OTHER)
--   2. Replace contacts (jsonb) and availability (jsonb) with contact (varchar)
--   3. Add constraints on name and contact lengths

-- Étape 1: Supprimer colonnes non utilisées
ALTER TABLE providers DROP COLUMN IF EXISTS contacts;
ALTER TABLE providers DROP COLUMN IF EXISTS availability;

-- Étape 2: Ajouter colonne contact (string simple)
ALTER TABLE providers ADD COLUMN IF NOT EXISTS contact VARCHAR(200);

-- Étape 3: Modifier enum ProviderType
-- Créer nouveau type temporaire
CREATE TYPE "ProviderType_new" AS ENUM ('TELECOM', 'INTERNET', 'CLOUD', 'HOSTING', 'OTHER');

-- Mapper anciennes valeurs → nouvelles
ALTER TABLE providers ALTER COLUMN type DROP DEFAULT;
ALTER TABLE providers ALTER COLUMN type TYPE "ProviderType_new"
  USING CASE
    WHEN type::text = 'CABLING' THEN 'TELECOM'::"ProviderType_new"
    WHEN type::text = 'OPERATOR' THEN 'INTERNET'::"ProviderType_new"
    WHEN type::text = 'INTEGRATOR' THEN 'OTHER'::"ProviderType_new"
    WHEN type::text = 'MAINTENANCE' THEN 'OTHER'::"ProviderType_new"
    ELSE 'OTHER'::"ProviderType_new"
  END;

-- Supprimer ancien enum
DROP TYPE "ProviderType";

-- Renommer nouveau enum
ALTER TYPE "ProviderType_new" RENAME TO "ProviderType";

-- Étape 4: Modifier contraintes colonnes
-- Modifier name pour ajouter limite de longueur
ALTER TABLE providers ALTER COLUMN name TYPE VARCHAR(100);
