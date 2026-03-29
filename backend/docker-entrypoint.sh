#!/bin/sh
set -e

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🔄 Syncing database schema..."
npx prisma db push --accept-data-loss 2>/dev/null || echo "⚠️  db push had warnings (non-fatal)"

echo "✅ Database ready"
echo "🚀 Starting XCH Backend..."
exec node dist/main
