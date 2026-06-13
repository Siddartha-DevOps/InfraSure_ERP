#!/usr/bin/env bash
# Verify the API against a REAL Postgres (and optionally MongoDB).
#
# Provision a throwaway Postgres any way you like (Docker, a managed instance, or
# a local cluster) and point this script at it:
#
#   TEST_DATABASE_URL=postgresql://user:pass@host:5432/db \
#   [MONGO_URL=mongodb://localhost:27017] \
#   scripts/verify-live-db.sh
#
# It pushes the full Prisma schema, seeds demo data, and runs the integration
# suite (positive path + cross-tenant rejection + RBAC; audit-persistence too
# when MONGO_URL is set). Exits non-zero on any failure.
set -euo pipefail

: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to a real Postgres connection string}"
export DATABASE_URL="$TEST_DATABASE_URL"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ prisma generate"
npx prisma generate --schema packages/db/prisma/schema.prisma >/dev/null

echo "→ prisma db push (materialise schema)"
npx prisma db push --schema packages/db/prisma/schema.prisma --skip-generate

echo "→ seed demo data"
node apps/api/prisma/seed.js >/dev/null

echo "→ integration tests"
TEST_DATABASE_URL="$DATABASE_URL" npm run test:integration --workspace apps/api

echo "✓ live-DB verification passed"
