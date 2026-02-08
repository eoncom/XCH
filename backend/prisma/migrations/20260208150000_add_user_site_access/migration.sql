-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SiteAccessLevel" AS ENUM ('READ', 'WRITE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_site_access" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "accessLevel" "SiteAccessLevel" NOT NULL DEFAULT 'READ',
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_site_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_site_access_tenantId_idx" ON "user_site_access"("tenantId");
CREATE INDEX IF NOT EXISTS "user_site_access_userId_idx" ON "user_site_access"("userId");
CREATE INDEX IF NOT EXISTS "user_site_access_siteId_idx" ON "user_site_access"("siteId");
CREATE UNIQUE INDEX IF NOT EXISTS "user_site_access_userId_siteId_key" ON "user_site_access"("userId", "siteId");

-- AddForeignKey
ALTER TABLE "user_site_access" ADD CONSTRAINT "user_site_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_site_access" ADD CONSTRAINT "user_site_access_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
