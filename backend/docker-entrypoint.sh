#!/bin/sh
set -e

# Worker mode (ADR-014) — same image, different role. The worker does NOT
# run migrations: the API container does, and racing two `prisma db push`
# at startup would cause Postgres advisory-lock contention.
if [ "$XCH_MODE" = "worker" ]; then
  echo "🛠️  XCH_MODE=worker — skipping prisma migrations (handled by API)"
  echo "🚀 Starting XCH Backend Worker (no HTTP)..."
  exec node dist/main --worker
fi

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🔄 Applying database schema..."
npx prisma db push --accept-data-loss

# Defense-in-depth CHECK constraints (ADR-014, prisma/post-push.sql).
# Idempotent — safe to re-run on every API boot.
echo "🔒 Applying post-push SQL constraints..."
npx prisma db execute --file ./prisma/post-push.sql --schema ./prisma/schema.prisma || \
  echo "⚠️  post-push.sql failed (table may not exist yet on a fresh install — will retry next boot)"

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
