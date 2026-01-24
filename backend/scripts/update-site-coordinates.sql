-- Script to update site coordinates with PostGIS
-- Run this on the production database to add GPS coordinates to existing sites

-- Paris La Défense
UPDATE "sites"
SET coordinates = ST_SetSRID(ST_MakePoint(2.2372, 48.8919), 4326)
WHERE code = 'PAR-001';

-- Lyon Part-Dieu
UPDATE "sites"
SET coordinates = ST_SetSRID(ST_MakePoint(4.8594, 45.7602), 4326)
WHERE code = 'LYN-002';

-- Marseille Vieux-Port
UPDATE "sites"
SET coordinates = ST_SetSRID(ST_MakePoint(5.3730, 43.2954), 4326)
WHERE code = 'MRS-003';

-- Bordeaux Mérignac
UPDATE "sites"
SET coordinates = ST_SetSRID(ST_MakePoint(-0.6874, 44.8364), 4326)
WHERE code = 'BDX-004';

-- Toulouse Aerospace
UPDATE "sites"
SET coordinates = ST_SetSRID(ST_MakePoint(1.4397, 43.6108), 4326)
WHERE code = 'TLS-005';

-- Verify the updates
SELECT code, name, ST_Y(coordinates::geometry) as latitude, ST_X(coordinates::geometry) as longitude
FROM "sites"
WHERE coordinates IS NOT NULL;
