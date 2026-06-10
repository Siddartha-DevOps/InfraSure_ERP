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
│   ├── api/        Node.js + Express + Apollo GraphQL  (Phase 1)
│   ├── web/        React + Vite + Tailwind             (Phase 1, shell)
│   └── mobile/     React Native (Expo) field app       (Phase 4)
├── services/
│   └── ai-engine/  Python FastAPI AI engine            (Phase 4)
├── packages/
│   └── db/         Prisma schema + migrations (PostgreSQL)
├── infra/          docker-compose: Postgres, MongoDB, Redis, ai-engine
└── docs/           PLAN.md, ARCHITECTURE.md
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

## Phase 2 scope (Compliance core)

- **Financial Compliance:** GST + TDS filing, RA-bill approval, payment recording &
  overdue tracking (`createFinanceRecord`, `fileGST`, `fileTDS`, `approveRABill`, `recordPayment`).
- **Safety & Environment:** safety audits with site + PPE-compliance %, and pollution/waste
  environmental logs (`logSafetyAudit`, `logEnvironmentalLog`).
- **Labour & RERA:** PF/ESI/wage-register filings and RERA filings with status workflows
  (`createLabourFiling`, `updateLabourFilingStatus`, `createReraFiling`, `updateReraFilingStatus`).
- **Compliance KPIs dashboard:** `getComplianceKPIs` computes filing %, approval %, safety
  completion %, PF/ESI/RERA rates, overdue payments, and a composite audit-readiness score.

All new operations are RBAC-gated per role and every mutation is audit-logged to MongoDB.

## Phase 3 scope (Trust & money)

- **Vendor compliance:** vendor/subcontractor registry with certification-expiry alerts
  (`getVendors`, `getExpiringCertifications`, `createVendor`, `updateVendorStatus`).
- **Risk & dispute tracking:** dispute register with escalation workflow
  (`getDisputes`, `createDispute`, `updateDisputeStatus`, `escalateDispute`).
- **Audit Readiness dashboard:** `getAuditReadiness` — documents verified, pending
  approvals, open disputes, vendor-compliance rate, and a composite readiness score.
- **Stripe billing & tiers:** BASIC/PRO/ENTERPRISE via a billing adapter
  (`getBillingTiers`, `getSubscription`, `changeSubscriptionPlan`, `createBillingCheckout`).
  Defaults to a **stub** driver; set `BILLING_DRIVER=stripe` + `STRIPE_SECRET_KEY` for real
  Stripe Checkout. Billing is ADMIN-only.

## Phase 4 scope (Advanced)

- **AI compliance engine** (`services/ai-engine`, FastAPI): anomaly detection +
  predictive compliance scoring + OCR stub. Exposed via `getAIInsights`, which degrades
  gracefully if the engine is offline. Run it with `docker compose up ai-engine` or
  `uvicorn main:app` (see `services/ai-engine`).
- **External integrations** (`apps/api/src/integrations`): Tally/SAP, GST portal, RERA,
  Aadhaar e-sign, BIM — stub-by-default adapters, "live" once each credential is set.
  `getIntegrationStatus` + `syncTallyLedger` / `fileGSTReturn` / `syncReraUpdates` /
  `requestAadhaarESign` / `importBimModel`.
- **React Native field app** (`apps/mobile`, Expo): login, geo-tagged DPRs, site photos,
  offline-first queue. See `apps/mobile/README.md` (scaffold — run locally with Expo).

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

## Deploying

### Web app (Vercel)

This is an npm-workspaces monorepo, so Vercel needs to know where the web app is.
**Both** Root Directory configurations are covered out of the box:

- **Root Directory = repo root (default):** the root [`vercel.json`](vercel.json)
  builds the workspace (`npm run build --workspace apps/web`), serves `apps/web/dist`,
  and rewrites all paths → `/index.html`.
- **Root Directory = `apps/web`:** Vercel auto-detects Vite and reads
  [`apps/web/vercel.json`](apps/web/vercel.json) for the SPA `/index.html` rewrite.

Without this, Vercel builds from the repo root (which has no `index.html`) and every
URL returns Vercel's `404: NOT_FOUND` page.

> **You must redeploy.** Config changes only take effect on the **next** deployment —
> trigger a fresh deploy (or push) after pulling these files; an existing/cached
> deployment will keep 404-ing until then.

> **Set `VITE_API_URL`.** The web app reads the GraphQL endpoint from `VITE_API_URL`
> (`apps/web/src/api.js`), defaulting to `http://localhost:4000/graphql`. In your Vercel
> project's **Environment Variables**, set `VITE_API_URL` to your deployed API's public
> `/graphql` URL — otherwise the deployed frontend will try to reach `localhost` and
> login/queries will fail.

### API (separate host)

Vercel is static/serverless; the Express + Apollo API and its datastores (PostgreSQL,
MongoDB, Redis) do **not** run there as-is. Host the API on a container/VM platform
(Render, Railway, Fly.io, ECS, a VM, …) with those datastores provisioned, set the API's
env vars (`DATABASE_URL`, `MONGO_URL`, `JWT_SECRET`, …), then point the web app's
`VITE_API_URL` at it.
