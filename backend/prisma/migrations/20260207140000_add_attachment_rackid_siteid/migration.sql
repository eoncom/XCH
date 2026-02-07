-- AlterTable: Add rackId and siteId columns to attachments
ALTER TABLE "attachments" ADD COLUMN "rackId" TEXT;
ALTER TABLE "attachments" ADD COLUMN "siteId" TEXT;

-- CreateIndex
CREATE INDEX "attachments_tenantId_rackId_idx" ON "attachments"("tenantId", "rackId");
CREATE INDEX "attachments_tenantId_siteId_idx" ON "attachments"("tenantId", "siteId");
