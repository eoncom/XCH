-- AlterTable
ALTER TABLE "assets" ADD COLUMN "rackNotes" TEXT;

-- AlterTable
ALTER TABLE "user_site_access" ADD COLUMN "resourcePermissions" JSONB;
