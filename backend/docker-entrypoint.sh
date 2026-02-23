#!/bin/sh
set -e

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "✅ Database ready"
echo "🚀 Starting XCH Backend..."
exec node dist/main
