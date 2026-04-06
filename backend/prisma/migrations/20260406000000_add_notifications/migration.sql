-- CreateTable: notification_configs
CREATE TABLE "notification_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeType" VARCHAR(20) NOT NULL,
    "scopeId" TEXT NOT NULL,
    "channels" JSONB NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notification_logs
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "scopeType" VARCHAR(20),
    "scopeId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_configs_tenantId_idx" ON "notification_configs"("tenantId");
CREATE UNIQUE INDEX "notification_configs_tenantId_scopeType_scopeId_key" ON "notification_configs"("tenantId", "scopeType", "scopeId");

CREATE INDEX "notification_logs_tenantId_createdAt_idx" ON "notification_logs"("tenantId", "createdAt");
CREATE INDEX "notification_logs_tenantId_eventType_idx" ON "notification_logs"("tenantId", "eventType");

-- AddForeignKey
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
