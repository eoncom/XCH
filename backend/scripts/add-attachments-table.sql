-- Migration: add_attachments
-- Created: 2026-01-29
-- Purpose: Add Attachment model for file uploads on Assets and Tasks

-- Create attachments table
CREATE TABLE IF NOT EXISTS "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "attachments_tenantId_idx" ON "attachments"("tenantId");
CREATE INDEX IF NOT EXISTS "attachments_tenantId_assetId_idx" ON "attachments"("tenantId", "assetId");
CREATE INDEX IF NOT EXISTS "attachments_tenantId_taskId_idx" ON "attachments"("tenantId", "taskId");

-- Add constraint: assetId OR taskId (at least one must be set)
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_entity_check"
    CHECK ((("assetId" IS NOT NULL) AND ("taskId" IS NULL)) OR (("assetId" IS NULL) AND ("taskId" IS NOT NULL)));

-- Prisma migration marker
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    'manual_migration_attachments',
    NOW(),
    '20260129_add_attachments',
    NULL,
    NULL,
    NOW(),
    1
);
