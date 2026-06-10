# InfraSure ERP

**Infrastructure Assurance Platform for Construction Compliance** — a multi-tenant SaaS that
helps Indian construction firms manage compliance across contracts, finance (GST/TDS/RA bills),
safety, environment, labour, RERA, and vendors.

See [`docs/PLAN.md`](docs/PLAN.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
full roadmap and architecture.

## Monorepo layout

```
infrasure-erp/
├── apps/
│   ├── api/      Node.js + Express + Apollo GraphQL  (Phase 1)
│   └── web/      React + Vite + Tailwind             (Phase 1, shell)
├── packages/
│   └── db/       Prisma schema + migrations (PostgreSQL)
├── infra/        docker-compose: Postgres, MongoDB, Redis
└── docs/         PLAN.md, ARCHITECTURE.md
```

## Quick start (Phase 1)

```bash
# 1. Start datastores
docker compose -f infra/docker-compose.yml up -d

# 2. Install deps
npm install

# 3. Generate Prisma client + run migrations + seed demo tenant
npm run db:setup --workspace apps/api

# 4. Run the API
npm run dev --workspace apps/api      # GraphQL at http://localhost:4000/graphql

# 5. Run the web shell (separate terminal)
npm run dev --workspace apps/web      # http://localhost:5173
```

## Phase 1 scope

- Multi-tenant shared-schema model (`tenant_id` on every business table).
- JWT auth (claims: `tenant_id` + `role`) with tenant-mismatch rejection.
- RBAC: role → allowed GraphQL operations (Engineer, Accountant, Compliance Officer,
  Project Manager, Admin).
- Audit logging of every mutation to MongoDB.
- Contracts, Finance, and Safety domain types + tenant-scoped queries/mutations.
- **Contract expiry alerts:** `getExpiringContracts(tenant_id, withinDays)` query +
  dashboard "Expiry Alerts" card highlighting contracts due within 30 days.
- **Document upload (REST):** attach files to contracts via a tenant-isolated,
  RBAC-checked, audit-logged endpoint backed by a local-disk / S3-ready storage adapter.
- Seed data: one demo tenant + a user per role.

Default demo credentials are printed by the seed script.

## Contract document upload (REST)

File uploads stay on REST (per the Phase 1 decision); everything else is GraphQL.

```bash
curl -X POST http://localhost:4000/api/contracts/<CONTRACT_ID>/document \
  -H "Authorization: Bearer <JWT>" \
  -F "tenant_id=<TENANT_ID>" \
  -F "file=@./contract.pdf"
# → { "contract_id": "...", "document_url": "/files/<uuid>-contract.pdf" }
```

Storage is configured via `STORAGE_DRIVER` (default `local`) and `UPLOAD_DIR`
(default `uploads/`). In dev, stored files are served from `/files/*`. To move to
S3 later, implement the `s3` branch in `apps/api/src/storage.js` — callers are unchanged.
