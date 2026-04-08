#!/bin/sh
set -e

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🔄 Applying database schema..."
npx prisma db push --accept-data-loss

# Seed only if AUTO_SEED=true (manual: docker exec xch-backend npx prisma db seed)
if [ "$AUTO_SEED" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed || echo "⚠️ Seed skipped (may already exist)"
else
  echo "ℹ️  Auto-seed disabled. Use setup wizard or: docker exec xch-backend npx prisma db seed"
fi

echo "✅ Database ready"
echo "🚀 Starting XCH Backend..."
exec node dist/main
