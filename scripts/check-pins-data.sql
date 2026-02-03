-- Script de diagnostic pour vérifier les données des pins
-- À exécuter sur le serveur de production

-- 1. Vérifier combien de pins existent
SELECT 'Total pins' AS info, COUNT(*) AS count FROM "Pin";

-- 2. Vérifier la distribution des types de pins
SELECT
  'Pins by type' AS info,
  "pinType",
  COUNT(*) AS count
FROM "Pin"
GROUP BY "pinType"
ORDER BY count DESC;

-- 3. Vérifier s'il y a des pins avec pinType NULL
SELECT
  'Pins with NULL pinType' AS info,
  COUNT(*) AS count
FROM "Pin"
WHERE "pinType" IS NULL;

-- 4. Afficher tous les pins avec leurs données complètes
SELECT
  id,
  "floorPlanId",
  x,
  y,
  "pinType",
  "assetId",
  label,
  description,
  "createdAt"
FROM "Pin"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 5. Vérifier si les floor plans ont bien des pins
SELECT
  fp.id AS floor_plan_id,
  fp.title,
  s.name AS site_name,
  COUNT(p.id) AS pins_count
FROM "FloorPlan" fp
LEFT JOIN "Pin" p ON p."floorPlanId" = fp.id
LEFT JOIN "Site" s ON s.id = fp."siteId"
GROUP BY fp.id, fp.title, s.name
ORDER BY pins_count DESC;
