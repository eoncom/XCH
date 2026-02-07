-- AlterTable: Add name column and make siteId optional
ALTER TABLE "assets" ADD COLUMN "name" TEXT;

-- DropForeignKey: Change from Cascade to SetNull for site relation
ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_siteId_fkey";

-- AlterColumn: Make siteId nullable
ALTER TABLE "assets" ALTER COLUMN "siteId" DROP NOT NULL;

-- AddForeignKey: Re-add with SetNull
ALTER TABLE "assets" ADD CONSTRAINT "assets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
