-- Add QR code persistence fields to assets
ALTER TABLE "assets" ADD COLUMN "qrCodeUrl" TEXT;
ALTER TABLE "assets" ADD COLUMN "qrCodeToken" TEXT;
