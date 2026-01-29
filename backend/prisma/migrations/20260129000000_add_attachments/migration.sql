-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT,
    "taskId" TEXT,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimetype" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_tenantId_idx" ON "attachments"("tenantId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_assetId_idx" ON "attachments"("tenantId", "assetId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_taskId_idx" ON "attachments"("tenantId", "taskId");

-- AddCheckConstraint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_entity_check"
    CHECK ((("assetId" IS NOT NULL) AND ("taskId" IS NULL)) OR (("assetId" IS NULL) AND ("taskId" IS NOT NULL)));
