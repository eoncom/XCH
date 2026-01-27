-- AlterTable
ALTER TABLE "sites" ADD COLUMN "emplacements" JSONB,
ADD COLUMN "governanceDocsRef" TEXT;

-- Comment on columns
COMMENT ON COLUMN "sites"."emplacements" IS 'Array of document emplacements (SMB/SharePoint links): [{type: smb|sharepoint, url, description}]';
COMMENT ON COLUMN "sites"."governanceDocsRef" IS 'URL to governance documents reference (Référentiel droits documents)';
