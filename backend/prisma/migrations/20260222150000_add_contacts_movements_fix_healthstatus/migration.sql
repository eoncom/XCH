-- Migration: Add missing tables (contacts, contact_types, asset_movements, integration_mappings)
-- and fix HealthStatus enum (OK → HEALTHY)
-- Date: 2026-02-22

-- ============================================================================
-- Fix HealthStatus enum: rename OK → HEALTHY
-- ============================================================================
ALTER TYPE "HealthStatus" RENAME VALUE 'OK' TO 'HEALTHY';

-- ============================================================================
-- Add ContactCategory enum
-- ============================================================================
CREATE TYPE "ContactCategory" AS ENUM ('PROVIDER', 'INTERNAL', 'PARTNER', 'TECHNICAL', 'EMERGENCY');

-- ============================================================================
-- Add AssetMovementType enum (if not exists)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE "AssetMovementType" AS ENUM ('SITE_TRANSFER', 'RACK_CHANGE', 'STATUS_CHANGE', 'CREATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Create contact_types table
-- ============================================================================
CREATE TABLE "contact_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "category" "ContactCategory" NOT NULL,
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_types_pkey" PRIMARY KEY ("id")
);

-- Indexes for contact_types
CREATE INDEX "contact_types_tenantId_isActive_idx" ON "contact_types"("tenantId", "isActive");
CREATE UNIQUE INDEX "contact_types_tenantId_slug_key" ON "contact_types"("tenantId", "slug");

-- FK for contact_types
ALTER TABLE "contact_types" ADD CONSTRAINT "contact_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Create contacts table
-- ============================================================================
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "typeId" TEXT NOT NULL,
    "email" VARCHAR(100),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "address" TEXT,
    "company" VARCHAR(100),
    "role" VARCHAR(100),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- Indexes for contacts
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");
CREATE INDEX "contacts_tenantId_typeId_idx" ON "contacts"("tenantId", "typeId");

-- FKs for contacts
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "contact_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Create asset_movements table
-- ============================================================================
CREATE TABLE "asset_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "AssetMovementType" NOT NULL,
    "fromSiteId" TEXT,
    "toSiteId" TEXT,
    "fromRackId" TEXT,
    "toRackId" TEXT,
    "fromPosition" INTEGER,
    "toPosition" INTEGER,
    "fromStatus" "AssetStatus",
    "toStatus" "AssetStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_movements_pkey" PRIMARY KEY ("id")
);

-- Indexes for asset_movements
CREATE INDEX "asset_movements_assetId_idx" ON "asset_movements"("assetId");
CREATE INDEX "asset_movements_tenantId_idx" ON "asset_movements"("tenantId");

-- FKs for asset_movements
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Create integration_mappings table
-- ============================================================================
CREATE TABLE "integration_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalData" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_mappings_pkey" PRIMARY KEY ("id")
);

-- Indexes for integration_mappings
CREATE INDEX "integration_mappings_tenantId_provider_idx" ON "integration_mappings"("tenantId", "provider");
CREATE UNIQUE INDEX "integration_mappings_tenantId_provider_entityType_externalId_key" ON "integration_mappings"("tenantId", "provider", "entityType", "externalId");

-- FK for integration_mappings
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Add FK from external_refs to contacts (if not already present)
-- ============================================================================
-- external_refs already has a generic entityId field, no direct FK needed
