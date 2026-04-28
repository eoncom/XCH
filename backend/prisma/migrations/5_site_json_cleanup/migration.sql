-- =============================================================================
-- 5_site_json_cleanup — ADR-018 Décision D
--
-- Last 4 JSON bags on Site dropped:
--   D.1 contacts JSON-array → Contact rows (table already exists)
--   D.2 accessNotes JSON {schedules,badges,procedures,safety} → 4 Text columns
--   D.3 emplacements JSON-list → SiteEmplacement table + EmplacementType enum
--   D.4 metadata.serverInfo JSON → 4 scalar columns (notes already on Site)
--   + drop Site.metadata column entirely (no consumer left post-cible C).
-- =============================================================================

-- D.1 — contacts JSON array → Contact rows ----------------------------------

-- Add isPrimary column on contacts (promoted from former Site.contacts JSON).
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Migrate any existing Site.contacts JSON entries. typeId is required (FK
-- to contact_types), so we use the first available ContactType for the same
-- tenant. With demo data reset, this INSERT scans 0 rows and is a no-op;
-- on a real upgrade with content it falls back to an arbitrary ContactType.
INSERT INTO "contacts" (id, "tenantId", "siteId", "typeId", name, phone, email, "role", "isPrimary", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s."tenantId",
  s.id,
  (SELECT ct.id FROM "contact_types" ct WHERE ct."tenantId" = s."tenantId" LIMIT 1),
  COALESCE(c->>'name', '(sans nom)'),
  NULLIF(c->>'phone', ''),
  NULLIF(c->>'email', ''),
  NULLIF(c->>'role', ''),
  COALESCE((c->>'isPrimary')::boolean, false),
  true,
  NOW(),
  NOW()
FROM "sites" s,
     jsonb_array_elements(COALESCE(s.contacts, '[]'::jsonb)) AS c
WHERE s.contacts IS NOT NULL
  AND jsonb_array_length(s.contacts) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "contacts" existing
    WHERE existing."siteId" = s.id
      AND COALESCE(existing.email, '') = COALESCE(c->>'email', '')
      AND COALESCE(existing.phone, '') = COALESCE(c->>'phone', '')
  );

ALTER TABLE "sites" DROP COLUMN "contacts";

-- D.2 — accessNotes JSON → 4 scalar Text columns ----------------------------

ALTER TABLE "sites"
  ADD COLUMN "accessSchedules"  TEXT,
  ADD COLUMN "accessBadges"     TEXT,
  ADD COLUMN "accessProcedures" TEXT,
  ADD COLUMN "accessSafety"     TEXT;

UPDATE "sites" SET
  "accessSchedules"  = NULLIF("accessNotes"->>'schedules',  ''),
  "accessBadges"     = NULLIF("accessNotes"->>'badges',     ''),
  "accessProcedures" = NULLIF("accessNotes"->>'procedures', ''),
  "accessSafety"     = NULLIF("accessNotes"->>'safety',     '')
WHERE "accessNotes" IS NOT NULL;

ALTER TABLE "sites" DROP COLUMN "accessNotes";

-- D.3 — emplacements JSON-list → SiteEmplacement table + enum ---------------

CREATE TYPE "EmplacementType" AS ENUM ('SMB', 'SHAREPOINT');

CREATE TABLE "site_emplacements" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "siteId"      TEXT NOT NULL,
  "type"        "EmplacementType" NOT NULL,
  "url"         TEXT NOT NULL,
  "description" TEXT,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_emplacements_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "site_emplacements_siteId_idx" ON "site_emplacements"("siteId");

INSERT INTO "site_emplacements" (id, "siteId", "type", url, description, "order", "createdAt")
SELECT
  gen_random_uuid()::text,
  s.id,
  UPPER(e->>'type')::"EmplacementType",
  e->>'url',
  NULLIF(e->>'description', ''),
  (ord - 1)::int,
  NOW()
FROM "sites" s,
     jsonb_array_elements(COALESCE(s.emplacements, '[]'::jsonb))
       WITH ORDINALITY AS arr(e, ord)
WHERE s.emplacements IS NOT NULL
  AND jsonb_array_length(s.emplacements) > 0
  AND e->>'type' IS NOT NULL
  AND UPPER(e->>'type') IN ('SMB', 'SHAREPOINT')
  AND e->>'url' IS NOT NULL
  AND e->>'url' <> '';

ALTER TABLE "sites" DROP COLUMN "emplacements";

-- D.4 — metadata.serverInfo → 4 scalar columns + drop metadata --------------

ALTER TABLE "sites"
  ADD COLUMN "smbPath"         TEXT,
  ADD COLUMN "sharepointUrl"   TEXT,
  ADD COLUMN "gedUrl"          TEXT,
  ADD COLUMN "accessRightsUrl" TEXT;

UPDATE "sites" SET
  "smbPath"         = NULLIF(metadata -> 'serverInfo' ->> 'smbPath',         ''),
  "sharepointUrl"   = NULLIF(metadata -> 'serverInfo' ->> 'sharepointUrl',   ''),
  "gedUrl"          = NULLIF(metadata -> 'serverInfo' ->> 'gedUrl',          ''),
  "accessRightsUrl" = NULLIF(metadata -> 'serverInfo' ->> 'accessRightsUrl', '')
WHERE metadata -> 'serverInfo' IS NOT NULL;

-- Merge serverInfo.notes into Site.notes only when the column is empty,
-- to avoid stomping operator-edited notes.
UPDATE "sites"
SET "notes" = NULLIF(metadata -> 'serverInfo' ->> 'notes', '')
WHERE COALESCE("notes", '') = ''
  AND metadata -> 'serverInfo' ->> 'notes' IS NOT NULL
  AND metadata -> 'serverInfo' ->> 'notes' <> '';

ALTER TABLE "sites" DROP COLUMN "metadata";
