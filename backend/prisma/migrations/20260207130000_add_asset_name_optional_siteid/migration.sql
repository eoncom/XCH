-- AlterTable: Add name column and make siteId optional
ALTER TABLE "Asset" ADD COLUMN "name" TEXT;

-- DropForeignKey: Change from Cascade to SetNull for site relation
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_siteId_fkey";

-- AlterColumn: Make siteId nullable
ALTER TABLE "Asset" ALTER COLUMN "siteId" DROP NOT NULL;

-- AddForeignKey: Re-add with SetNull
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
