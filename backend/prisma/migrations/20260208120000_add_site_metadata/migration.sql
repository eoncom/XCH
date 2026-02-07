-- AlterTable
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
