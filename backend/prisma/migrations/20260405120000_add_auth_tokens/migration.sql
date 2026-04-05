-- AlterTable
ALTER TABLE "users" ADD COLUMN "inviteToken" TEXT,
ADD COLUMN "inviteTokenExpiry" TIMESTAMP(3),
ADD COLUMN "resetToken" TEXT,
ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_inviteToken_key" ON "users"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");
