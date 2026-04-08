#!/bin/sh
set -e

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🔄 Applying database schema..."
npx prisma db push --accept-data-loss

echo "🌱 Seeding database..."
npx prisma db seed || echo "⚠️ Seed skipped (may already exist)"

echo "✅ Database ready"
echo "🚀 Starting XCH Backend..."
exec node dist/main
