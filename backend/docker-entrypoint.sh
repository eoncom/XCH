#!/bin/sh
set -e

# Worker mode (ADR-014) — same image, different role. The worker does NOT
# run migrations: the API container does, and racing two `prisma migrate deploy`
# at startup would cause Postgres advisory-lock contention.
if [ "$XCH_MODE" = "worker" ]; then
  echo "🛠️  XCH_MODE=worker — skipping prisma migrations (handled by API)"
  echo "🚀 Starting XCH Backend Worker (no HTTP)..."
  exec node dist/main --worker
fi

echo "🔄 Generating Prisma client..."
npx prisma generate

# ADR-017: versioned migrations replace `db push --accept-data-loss`.
# `migrate deploy` takes its own advisory lock, so concurrent boots are safe.
# Boot fails strictly on schema drift — no silent destructive repair.
echo "🔄 Applying versioned migrations..."
npx prisma migrate deploy

# Seed only if AUTO_SEED=true (manual: docker exec xch-backend npx prisma db seed)
if [ "$AUTO_SEED" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed || echo "⚠️ Seed skipped (may already exist)"
else
  echo "ℹ️  Auto-seed disabled. Use setup wizard or: docker exec xch-backend npx prisma db seed"
fi

echo "✅ Database ready"
echo "🚀 Starting XCH Backend API..."
exec node dist/main
