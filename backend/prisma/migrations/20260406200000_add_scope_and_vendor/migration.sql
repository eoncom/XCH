-- =============================================================================
-- Migration: Add scope (scopeType/scopeId) to BillingEntity, Expense, Contact
--            Add vendorId FK on Expense -> Contact
-- =============================================================================

-- ── BillingEntity: scope organisationnel ─────────────────────────────────────
ALTER TABLE "billing_entities" ADD COLUMN "scopeType" VARCHAR(20);
ALTER TABLE "billing_entities" ADD COLUMN "scopeId" TEXT;

-- Migrate existing loose FK fields to scopeType/scopeId
UPDATE "billing_entities" SET "scopeType" = 'SITE', "scopeId" = "siteId" WHERE "siteId" IS NOT NULL;
UPDATE "billing_entities" SET "scopeType" = 'DELEGATION', "scopeId" = "delegationId" WHERE "delegationId" IS NOT NULL AND "scopeType" IS NULL;
UPDATE "billing_entities" SET "scopeType" = 'DIVISION', "scopeId" = "divisionId" WHERE "divisionId" IS NOT NULL AND "scopeType" IS NULL;

CREATE INDEX "billing_entities_tenantId_scopeType_scopeId_idx" ON "billing_entities"("tenantId", "scopeType", "scopeId");

-- ── Expense: scope organisationnel ───────────────────────────────────────────
ALTER TABLE "expenses" ADD COLUMN "scopeType" VARCHAR(20);
ALTER TABLE "expenses" ADD COLUMN "scopeId" TEXT;

-- Migrate existing siteId to scopeType/scopeId
UPDATE "expenses" SET "scopeType" = 'SITE', "scopeId" = "siteId" WHERE "siteId" IS NOT NULL;

CREATE INDEX "expenses_tenantId_scopeType_scopeId_idx" ON "expenses"("tenantId", "scopeType", "scopeId");

-- ── Expense: vendor FK -> Contact ────────────────────────────────────────────
ALTER TABLE "expenses" ADD COLUMN "vendorId" TEXT;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "expenses_vendorId_idx" ON "expenses"("vendorId");

-- ── Contact: scope organisationnel ───────────────────────────────────────────
ALTER TABLE "contacts" ADD COLUMN "scopeType" VARCHAR(20);
ALTER TABLE "contacts" ADD COLUMN "scopeId" TEXT;

CREATE INDEX "contacts_tenantId_scopeType_scopeId_idx" ON "contacts"("tenantId", "scopeType", "scopeId");
