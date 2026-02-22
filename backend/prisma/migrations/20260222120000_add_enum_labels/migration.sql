-- CreateTable
CREATE TABLE "enum_labels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enumType" TEXT NOT NULL,
    "enumValue" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enum_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enum_labels_tenantId_idx" ON "enum_labels"("tenantId");

-- CreateIndex
CREATE INDEX "enum_labels_tenantId_enumType_idx" ON "enum_labels"("tenantId", "enumType");

-- CreateIndex
CREATE UNIQUE INDEX "enum_labels_tenantId_enumType_enumValue_key" ON "enum_labels"("tenantId", "enumType", "enumValue");

-- AddForeignKey
ALTER TABLE "enum_labels" ADD CONSTRAINT "enum_labels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
