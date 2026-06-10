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
- Seed data: one demo tenant + a user per role.

Default demo credentials are printed by the seed script.
