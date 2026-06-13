#!/bin/sh
# Apply the Prisma schema to the database, then start the API.
# Uses `db push` (no migration history needed) — fine for managed-DB hosting.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "==> Applying database schema (prisma db push)…"
  npx prisma db push --schema packages/db/prisma/schema.prisma --skip-generate

  # Optional one-time demo seed (idempotent — skips if users already exist).
  # Set SEED_ON_START=true to populate a demo tenant + the 8 role logins.
  if [ "$SEED_ON_START" = "true" ]; then
    echo "==> Seeding demo data (idempotent)…"
    node apps/api/prisma/seed.js || echo "==> Seed skipped/failed (continuing)."
  fi
else
  echo "==> WARNING: DATABASE_URL not set; skipping schema push."
fi

echo "==> Starting InfraSure API…"
exec node apps/api/src/index.js
