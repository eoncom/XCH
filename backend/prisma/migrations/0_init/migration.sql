-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "DelegationRight" AS ENUM ('MANAGE', 'WRITE', 'READ');

-- CreateEnum
CREATE TYPE "OverrideEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('READ', 'WRITE');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('PREPARATION', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssetMovementType" AS ENUM ('SITE_CHANGE', 'RACK_MOUNT', 'RACK_UNMOUNT', 'RACK_MOVE', 'RACK_CHANGE', 'STATUS_CHANGE', 'CREATED');

-- CreateEnum
CREATE TYPE "RackType" AS ENUM ('WALL_MOUNTED', 'FLOOR_STANDING', 'ENCLOSED_CABINET');

-- CreateEnum
CREATE TYPE "RackStatus" AS ENUM ('IN_SERVICE', 'OUT_OF_SERVICE', 'PREPARATION');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ContactCategory" AS ENUM ('PROVIDER', 'INTERNAL', 'PARTNER', 'TECHNICAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('SITE', 'ASSET', 'TASK', 'RACK', 'CONTACT');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('EQUIPMENT', 'SERVICE', 'PROJECT', 'CONSUMABLE', 'LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ConnectivityRole" AS ENUM ('PRIMARY', 'BACKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "MonitorKind" AS ENUM ('ICMP', 'HTTP', 'TCP');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('UP', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'HEAD', 'POST');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#0070f3',
    "config" JSONB,
    "allowInternalNetworkTargets" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "externalId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'local',
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpBackupCodes" TEXT[],
    "inviteToken" TEXT,
    "inviteTokenExpiry" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appearancePreference" JSONB,
    "appearanceSource" TEXT NOT NULL DEFAULT 'inherit',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "groupLabel" VARCHAR(100),
    "groupColor" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_delegations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "right" "DelegationRight" NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'France',
    "coordinates" geometry(Point,4326),
    "contacts" JSONB,
    "accessNotes" JSONB,
    "cutProcedure" TEXT,
    "emplacements" JSONB,
    "governanceDocsRef" TEXT,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoGenerateElectricityExpense" BOOLEAN NOT NULL DEFAULT false,
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthCheck" TIMESTAMP(3),
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_catalogs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendor" VARCHAR(100) NOT NULL,
    "version" VARCHAR(50),
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT,

    CONSTRAINT "vendor_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_models" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "type" TEXT NOT NULL,
    "vendorCatalogId" TEXT,
    "acquisitionPrice" DECIMAL(10,2),
    "monthlyPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "pricingMode" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "powerConsumption" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "defaultUHeight" INTEGER,
    "wifiCoverageRadius" DOUBLE PRECISION,
    "wifiFrequency" TEXT,
    "wifiAntennaType" TEXT,
    "wifiTxPowerDbm" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "delegationId" TEXT,
    "siteId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "inventoryTag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_SERVICE',
    "assetModelId" TEXT,
    "acquisitionPrice" DECIMAL(10,2),
    "monthlyPrice" DECIMAL(10,2),
    "priceCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "locationText" TEXT,
    "networkInfo" JSONB,
    "rackId" TEXT,
    "rackPositionU" INTEGER,
    "rackHeightU" INTEGER,
    "rackNotes" TEXT,
    "qrCodeUrl" TEXT,
    "qrCodeToken" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "powerConsumption" DOUBLE PRECISION,
    "dutyCyclePercent" INTEGER NOT NULL DEFAULT 100,
    "notes" TEXT,
    "wifiCoverageRadius" DOUBLE PRECISION,
    "wifiFrequency" TEXT,
    "wifiAntennaType" TEXT,
    "wifiTxPowerDbm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "fromRackPositionU" INTEGER,
    "toRackPositionU" INTEGER,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "heightU" INTEGER NOT NULL,
    "rackType" "RackType" NOT NULL DEFAULT 'FLOOR_STANDING',
    "status" "RackStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "location" TEXT,
    "specs" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_plans" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "planGroupId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "notes" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scaleMetersPerPixel" DOUBLE PRECISION,
    "scaleRefLine" JSONB,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pins" (
    "id" TEXT NOT NULL,
    "floorPlanId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "pinType" TEXT NOT NULL,
    "assetId" TEXT,
    "rackId" TEXT,
    "label" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assetId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "createdBy" TEXT,
    "dueDate" TIMESTAMP(3),
    "ticketRef" TEXT,
    "ticketUrl" TEXT,
    "ticketStatus" TEXT,
    "estimatedCost" DECIMAL(10,2),
    "actualCost" DECIMAL(10,2),
    "costCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "expenseId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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
    "delegationId" TEXT,
    "siteId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalLabel" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_refs" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "metadata" JSONB,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT,
    "taskId" TEXT,
    "rackId" TEXT,
    "siteId" TEXT,
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

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "resource" TEXT NOT NULL DEFAULT '*',
    "effect" "OverrideEffect" NOT NULL,
    "permission" "PermissionLevel",
    "label" VARCHAR(100),
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "access_overrides_pkey" PRIMARY KEY ("id")
);

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
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConnectivityCapable" BOOLEAN NOT NULL DEFAULT false,
    "isSdwanCapable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enum_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_entities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "delegationId" TEXT,
    "siteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "ExpenseType" NOT NULL DEFAULT 'OTHER',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "frequency" "ExpenseFrequency" NOT NULL DEFAULT 'ONE_TIME',
    "dateIncurred" TIMESTAMP(3) NOT NULL,
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "bearerId" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "siteId" TEXT,
    "assetId" TEXT,
    "externalRef" VARCHAR(200),
    "vendorId" TEXT,
    "invoiceRef" VARCHAR(100),
    "poNumber" VARCHAR(50),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_allocations" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "delegationId" TEXT,
    "siteId" TEXT,
    "billingEntityId" TEXT,
    "expenseType" TEXT,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'YEAR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "parentId" TEXT,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertThresholdPct" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connectivity_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "role" "ConnectivityRole" NOT NULL DEFAULT 'PRIMARY',
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bandwidthDown" INTEGER,
    "bandwidthUp" INTEGER,
    "publicIp" TEXT,
    "monthlyPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "contractRef" TEXT,
    "notes" TEXT,
    "assetId" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connectivity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdwan_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sdwan_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdwan_firewalls" (
    "id" TEXT NOT NULL,
    "sdwanConfigId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sdwan_firewalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "delegationId" TEXT,
    "channels" JSONB NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "delegationId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_checks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT,
    "assetId" TEXT,
    "linkId" TEXT,
    "kind" "MonitorKind" NOT NULL,
    "target" TEXT NOT NULL,
    "targetPort" INTEGER,
    "intervalSec" INTEGER NOT NULL DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "lastStatus" "MonitorStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitor_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_http_configs" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "expectedStatus" INTEGER NOT NULL DEFAULT 200,
    "expectedBodyContains" TEXT,
    "followRedirects" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,

    CONSTRAINT "monitor_http_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_results" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "status" "MonitorStatus" NOT NULL,
    "responseMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_inviteToken_key" ON "users"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_externalId_idx" ON "users"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "delegations_tenantId_idx" ON "delegations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "delegations_tenantId_code_key" ON "delegations"("tenantId", "code");

-- CreateIndex
CREATE INDEX "user_delegations_tenantId_userId_idx" ON "user_delegations"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "user_delegations_delegationId_idx" ON "user_delegations"("delegationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_delegations_userId_delegationId_key" ON "user_delegations"("userId", "delegationId");

-- CreateIndex
CREATE INDEX "sites_tenantId_idx" ON "sites"("tenantId");

-- CreateIndex
CREATE INDEX "sites_tenantId_status_idx" ON "sites"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sites_tenantId_healthStatus_idx" ON "sites"("tenantId", "healthStatus");

-- CreateIndex
CREATE INDEX "sites_delegationId_idx" ON "sites"("delegationId");

-- CreateIndex
CREATE UNIQUE INDEX "sites_tenantId_code_key" ON "sites"("tenantId", "code");

-- CreateIndex
CREATE INDEX "vendor_catalogs_tenantId_idx" ON "vendor_catalogs"("tenantId");

-- CreateIndex
CREATE INDEX "vendor_catalogs_tenantId_vendor_idx" ON "vendor_catalogs"("tenantId", "vendor");

-- CreateIndex
CREATE INDEX "asset_models_tenantId_type_isActive_idx" ON "asset_models"("tenantId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "asset_models_tenantId_name_key" ON "asset_models"("tenantId", "name");

-- CreateIndex
CREATE INDEX "assets_tenantId_idx" ON "assets"("tenantId");

-- CreateIndex
CREATE INDEX "assets_tenantId_delegationId_idx" ON "assets"("tenantId", "delegationId");

-- CreateIndex
CREATE INDEX "assets_tenantId_siteId_idx" ON "assets"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "assets_tenantId_type_idx" ON "assets"("tenantId", "type");

-- CreateIndex
CREATE INDEX "assets_tenantId_status_idx" ON "assets"("tenantId", "status");

-- CreateIndex
CREATE INDEX "assets_rackId_idx" ON "assets"("rackId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenantId_serialNumber_key" ON "assets"("tenantId", "serialNumber");

-- CreateIndex
CREATE INDEX "asset_movements_tenantId_assetId_idx" ON "asset_movements"("tenantId", "assetId");

-- CreateIndex
CREATE INDEX "asset_movements_assetId_timestamp_idx" ON "asset_movements"("assetId", "timestamp");

-- CreateIndex
CREATE INDEX "racks_tenantId_idx" ON "racks"("tenantId");

-- CreateIndex
CREATE INDEX "racks_tenantId_siteId_idx" ON "racks"("tenantId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "racks_tenantId_siteId_name_key" ON "racks"("tenantId", "siteId", "name");

-- CreateIndex
CREATE INDEX "floor_plans_siteId_idx" ON "floor_plans"("siteId");

-- CreateIndex
CREATE INDEX "floor_plans_siteId_version_idx" ON "floor_plans"("siteId", "version");

-- CreateIndex
CREATE INDEX "floor_plans_planGroupId_idx" ON "floor_plans"("planGroupId");

-- CreateIndex
CREATE INDEX "pins_floorPlanId_idx" ON "pins"("floorPlanId");

-- CreateIndex
CREATE INDEX "pins_assetId_idx" ON "pins"("assetId");

-- CreateIndex
CREATE INDEX "pins_rackId_idx" ON "pins"("rackId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_idx" ON "tasks"("tenantId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_siteId_idx" ON "tasks"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_status_idx" ON "tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tasks_tenantId_assignedTo_idx" ON "tasks"("tenantId", "assignedTo");

-- CreateIndex
CREATE INDEX "tasks_tenantId_dueDate_idx" ON "tasks"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_expenseId_idx" ON "tasks"("expenseId");

-- CreateIndex
CREATE INDEX "task_checklist_items_taskId_idx" ON "task_checklist_items"("taskId");

-- CreateIndex
CREATE INDEX "task_checklist_items_taskId_order_idx" ON "task_checklist_items"("taskId", "order");

-- CreateIndex
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- CreateIndex
CREATE INDEX "task_comments_taskId_createdAt_idx" ON "task_comments"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "contact_types_tenantId_isActive_idx" ON "contact_types"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "contact_types_tenantId_slug_key" ON "contact_types"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");

-- CreateIndex
CREATE INDEX "contacts_tenantId_typeId_idx" ON "contacts"("tenantId", "typeId");

-- CreateIndex
CREATE INDEX "contacts_tenantId_delegationId_idx" ON "contacts"("tenantId", "delegationId");

-- CreateIndex
CREATE INDEX "integration_mappings_tenantId_provider_entityType_idx" ON "integration_mappings"("tenantId", "provider", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "integration_mappings_tenantId_provider_entityType_externalI_key" ON "integration_mappings"("tenantId", "provider", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "photos_entityType_entityId_idx" ON "photos"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "photos_uploadedAt_idx" ON "photos"("uploadedAt");

-- CreateIndex
CREATE INDEX "external_refs_entityType_entityId_idx" ON "external_refs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "external_refs_provider_idx" ON "external_refs"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "external_refs_entityType_entityId_provider_key" ON "external_refs"("entityType", "entityId", "provider");

-- CreateIndex
CREATE INDEX "attachments_tenantId_idx" ON "attachments"("tenantId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_assetId_idx" ON "attachments"("tenantId", "assetId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_taskId_idx" ON "attachments"("tenantId", "taskId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_rackId_idx" ON "attachments"("tenantId", "rackId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_siteId_idx" ON "attachments"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_timestamp_idx" ON "audit_logs"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_userId_idx" ON "audit_logs"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "access_overrides_tenantId_userId_idx" ON "access_overrides"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "access_overrides_tenantId_siteId_idx" ON "access_overrides"("tenantId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "access_overrides_tenantId_userId_siteId_resource_key" ON "access_overrides"("tenantId", "userId", "siteId", "resource");

-- CreateIndex
CREATE INDEX "enum_labels_tenantId_idx" ON "enum_labels"("tenantId");

-- CreateIndex
CREATE INDEX "enum_labels_tenantId_enumType_idx" ON "enum_labels"("tenantId", "enumType");

-- CreateIndex
CREATE INDEX "enum_labels_tenantId_enumType_isActive_idx" ON "enum_labels"("tenantId", "enumType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "enum_labels_tenantId_enumType_enumValue_key" ON "enum_labels"("tenantId", "enumType", "enumValue");

-- CreateIndex
CREATE INDEX "billing_entities_tenantId_idx" ON "billing_entities"("tenantId");

-- CreateIndex
CREATE INDEX "billing_entities_tenantId_delegationId_idx" ON "billing_entities"("tenantId", "delegationId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_entities_tenantId_code_key" ON "billing_entities"("tenantId", "code");

-- CreateIndex
CREATE INDEX "expenses_tenantId_idx" ON "expenses"("tenantId");

-- CreateIndex
CREATE INDEX "expenses_tenantId_type_idx" ON "expenses"("tenantId", "type");

-- CreateIndex
CREATE INDEX "expenses_bearerId_idx" ON "expenses"("bearerId");

-- CreateIndex
CREATE INDEX "expenses_tenantId_delegationId_idx" ON "expenses"("tenantId", "delegationId");

-- CreateIndex
CREATE INDEX "expenses_vendorId_idx" ON "expenses"("vendorId");

-- CreateIndex
CREATE INDEX "cost_allocations_expenseId_idx" ON "cost_allocations"("expenseId");

-- CreateIndex
CREATE INDEX "cost_allocations_targetId_idx" ON "cost_allocations"("targetId");

-- CreateIndex
CREATE INDEX "budgets_tenantId_startDate_endDate_idx" ON "budgets"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "budgets_tenantId_delegationId_idx" ON "budgets"("tenantId", "delegationId");

-- CreateIndex
CREATE INDEX "budgets_parentId_idx" ON "budgets"("parentId");

-- CreateIndex
CREATE INDEX "budgets_billingEntityId_idx" ON "budgets"("billingEntityId");

-- CreateIndex
CREATE INDEX "connectivity_links_tenantId_siteId_idx" ON "connectivity_links"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "connectivity_links_tenantId_role_idx" ON "connectivity_links"("tenantId", "role");

-- CreateIndex
CREATE INDEX "connectivity_links_assetId_idx" ON "connectivity_links"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "sdwan_configs_siteId_key" ON "sdwan_configs"("siteId");

-- CreateIndex
CREATE INDEX "sdwan_configs_tenantId_idx" ON "sdwan_configs"("tenantId");

-- CreateIndex
CREATE INDEX "sdwan_firewalls_sdwanConfigId_idx" ON "sdwan_firewalls"("sdwanConfigId");

-- CreateIndex
CREATE INDEX "sdwan_firewalls_assetId_idx" ON "sdwan_firewalls"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "sdwan_firewalls_sdwanConfigId_assetId_key" ON "sdwan_firewalls"("sdwanConfigId", "assetId");

-- CreateIndex
CREATE INDEX "notification_configs_tenantId_idx" ON "notification_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_configs_tenantId_delegationId_key" ON "notification_configs"("tenantId", "delegationId");

-- CreateIndex
CREATE INDEX "notification_logs_tenantId_createdAt_idx" ON "notification_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_tenantId_eventType_idx" ON "notification_logs"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "user_notifications_userId_readAt_idx" ON "user_notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "user_notifications_tenantId_createdAt_idx" ON "user_notifications"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "monitor_checks_tenantId_enabled_nextCheckAt_idx" ON "monitor_checks"("tenantId", "enabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "monitor_checks_siteId_idx" ON "monitor_checks"("siteId");

-- CreateIndex
CREATE INDEX "monitor_checks_assetId_idx" ON "monitor_checks"("assetId");

-- CreateIndex
CREATE INDEX "monitor_checks_linkId_idx" ON "monitor_checks"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_http_configs_checkId_key" ON "monitor_http_configs"("checkId");

-- CreateIndex
CREATE INDEX "monitor_results_checkId_checkedAt_idx" ON "monitor_results"("checkId", "checkedAt" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_delegations" ADD CONSTRAINT "user_delegations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_delegations" ADD CONSTRAINT "user_delegations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_delegations" ADD CONSTRAINT "user_delegations_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_catalogs" ADD CONSTRAINT "vendor_catalogs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_models" ADD CONSTRAINT "asset_models_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_models" ADD CONSTRAINT "asset_models_vendorCatalogId_fkey" FOREIGN KEY ("vendorCatalogId") REFERENCES "vendor_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assetModelId_fkey" FOREIGN KEY ("assetModelId") REFERENCES "asset_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_fromRackId_fkey" FOREIGN KEY ("fromRackId") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_toRackId_fkey" FOREIGN KEY ("toRackId") REFERENCES "racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pins" ADD CONSTRAINT "pins_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pins" ADD CONSTRAINT "pins_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pins" ADD CONSTRAINT "pins_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_types" ADD CONSTRAINT "contact_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "contact_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_siteId_fkey" FOREIGN KEY ("entityId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_assetId_fkey" FOREIGN KEY ("entityId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_taskId_fkey" FOREIGN KEY ("entityId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_refs" ADD CONSTRAINT "external_refs_siteId_fkey" FOREIGN KEY ("entityId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_refs" ADD CONSTRAINT "external_refs_assetId_fkey" FOREIGN KEY ("entityId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_refs" ADD CONSTRAINT "external_refs_contactId_fkey" FOREIGN KEY ("entityId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_overrides" ADD CONSTRAINT "access_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_overrides" ADD CONSTRAINT "access_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_overrides" ADD CONSTRAINT "access_overrides_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enum_labels" ADD CONSTRAINT "enum_labels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_entities" ADD CONSTRAINT "billing_entities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_entities" ADD CONSTRAINT "billing_entities_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_entities" ADD CONSTRAINT "billing_entities_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bearerId_fkey" FOREIGN KEY ("bearerId") REFERENCES "billing_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "billing_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_billingEntityId_fkey" FOREIGN KEY ("billingEntityId") REFERENCES "billing_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectivity_links" ADD CONSTRAINT "connectivity_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectivity_links" ADD CONSTRAINT "connectivity_links_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectivity_links" ADD CONSTRAINT "connectivity_links_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectivity_links" ADD CONSTRAINT "connectivity_links_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdwan_configs" ADD CONSTRAINT "sdwan_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdwan_configs" ADD CONSTRAINT "sdwan_configs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdwan_firewalls" ADD CONSTRAINT "sdwan_firewalls_sdwanConfigId_fkey" FOREIGN KEY ("sdwanConfigId") REFERENCES "sdwan_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdwan_firewalls" ADD CONSTRAINT "sdwan_firewalls_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_checks" ADD CONSTRAINT "monitor_checks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_checks" ADD CONSTRAINT "monitor_checks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_checks" ADD CONSTRAINT "monitor_checks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_checks" ADD CONSTRAINT "monitor_checks_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "connectivity_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_checks" ADD CONSTRAINT "monitor_checks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_http_configs" ADD CONSTRAINT "monitor_http_configs_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "monitor_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_results" ADD CONSTRAINT "monitor_results_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "monitor_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

