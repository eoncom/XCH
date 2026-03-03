-- AlterTable
ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "scaleMetersPerPixel" DOUBLE PRECISION;
ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "scaleRefLine" JSONB;
