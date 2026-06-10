#!/bin/sh
# Apply the Prisma schema to the database, then start the API.
# Uses `db push` (no migration history needed) — fine for managed-DB hosting.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "==> Applying database schema (prisma db push)…"
  npx prisma db push --schema packages/db/prisma/schema.prisma --skip-generate
else
  echo "==> WARNING: DATABASE_URL not set; skipping schema push."
fi

echo "==> Starting InfraSure API…"
exec node apps/api/src/index.js
