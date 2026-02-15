-- AlterTable: Add planGroupId to floor_plans
ALTER TABLE "floor_plans" ADD COLUMN "planGroupId" TEXT;

-- CreateIndex
CREATE INDEX "floor_plans_planGroupId_idx" ON "floor_plans"("planGroupId");

-- Backfill: Set planGroupId = id for all existing floor plans (each is its own group)
UPDATE "floor_plans" SET "planGroupId" = "id" WHERE "planGroupId" IS NULL;
