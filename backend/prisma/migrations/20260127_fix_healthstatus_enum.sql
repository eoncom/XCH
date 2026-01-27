-- Migration: Fix HealthStatus enum (OK → HEALTHY)
-- Date: 2026-01-27

BEGIN;

-- Step 1: Rename the enum value (PostgreSQL-specific approach)
ALTER TYPE "HealthStatus" RENAME VALUE 'OK' TO 'HEALTHY';

-- Step 2: Update all existing records (if any had 'OK', they're now 'HEALTHY')
-- No data update needed since ALTER TYPE handles it automatically

COMMIT;
