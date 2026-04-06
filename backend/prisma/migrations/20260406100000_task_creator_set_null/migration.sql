-- AlterTable: make Task.createdBy nullable and change onDelete to SetNull
-- This allows deleting users who have created tasks without FK constraint errors.

-- Drop the old foreign key constraint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_createdBy_fkey";

-- Make the column nullable
ALTER TABLE "tasks" ALTER COLUMN "createdBy" DROP NOT NULL;

-- Re-add the FK with ON DELETE SET NULL
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
