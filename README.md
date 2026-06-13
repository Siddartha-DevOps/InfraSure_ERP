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
- **Audit-readiness historical trend:** `ReadinessSnapshot` persists point-in-time
  readiness scores; `getAuditReadinessTrend` powers a line chart in the Reports module.
  `captureAuditReadinessSnapshot` (idempotent per day, audit-logged) appends a point — a
  daily scheduler/cron calls it in production, or Compliance/PM capture one manually via the
  **Capture snapshot** button. Seed includes 6 monthly snapshots so the trend renders.
- **Document-retrieval-time KPI:** `RetrievalEvent` records how fast each evidence pack /
  export / document is produced; the Reports module instruments its export actions
  (`recordRetrieval`) and surfaces real **avg / p95 / count** via `getRetrievalMetrics` —
  the audit "how fast can you produce a document" metric, no longer a placeholder.
- **Exports:** the Reports module exports per-domain **CSV** (contracts / finance / safety /
  audit log) plus a one-click **Compliance Pack PDF** (`src/pdf.js`) — a print-optimized
  evidence pack (readiness score + trend + compliance KPIs + contract/clearance/incident/
  finance registers) generated client-side with zero dependencies via the browser's
  Save-as-PDF, supporting the audit document-retrieval-time story.
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

## Design system & dashboards

Tokens live in `apps/web/tailwind.config.js`; components in `apps/web/src/ui.jsx`.

- **Palette:** Primary `#1E3A8A` (deep blue) · Success `#10B981` · Warning `#F59E0B` ·
  Danger `#DC2626` · Neutral `#6B7280` · Surface `#F3F4F6`.
- **Typography:** Inter (400–700); headings bold 18–24px, KPIs semi-bold 20–28px.
- **Layout:** left sidebar (modules + role quick actions) + top bar (alerts bell with
  severity badge, profile).
- **Components:** KPI cards (trend arrows), status pills (icon + text, never color-only),
  severity-coded alerts feed, dependency-free SVG line/bar charts, modals with
  inline-validated forms, site status board (🟢/🟡/🔴 per site).
- **Role dashboards:** Engineer (DPRs, safety, pending tasks) · Accountant (GST/TDS/RA
  actions, finance KPIs, charts) · Compliance Officer (audit readiness, env/labour logs,
  expiring certificates) · Project Manager/Admin (portfolio, trends, consolidated alerts,
  approvals).
- **Internationalization (EN / हिन्दी / తెలుగు):** `src/i18n.jsx` provides a
  `useI18n()` hook (with `{var}` interpolation) + language switcher (top bar). Coverage
  spans the full UI: chrome, dashboards, module tables, KPI labels, statuses, alerts
  (templated), forms, and validation messages. The active language is mirrored onto
  `<html lang>`. `t()` falls back to English then the key, so partial coverage degrades
  gracefully.
- **Geo project map:** `src/ProjectMap.jsx` (Leaflet + OpenStreetMap) plots `Site`
  records as status-colored markers (🟢 compliant / 🟡 pending / 🔴 non-compliant) on the
  Project Map tab and the PM/Admin home. Backed by the `Site` model + `getSites` /
  `createSite` / `updateSiteStatus`. **Geo-tagged mobile DPRs auto-populate the map:**
  `createDPR` parses the report's `location {lat, lng}` (+ optional `site_name`) and
  reuses a site within ~100 m or creates a new one (`apps/api/src/geo.js`).
- **Accessibility (WCAG 2.1 AA pass):** AA-contrast `*-text` color tokens for small text
  (`#047857` / `#B45309` / `#B91C1C`), skip-to-content link, `<html lang>` switching,
  `scope="col"` table headers, modal Escape-close + focus management, aria labels/roles,
  focus-visible rings, and icon+text statuses (never color-only). Remaining known gap:
  AI-engine anomaly sentences arrive in English from the Python service.

## Dashboard role architecture (Phase 1)

Nine roles span platform, company, and external actors:

| Tier | Roles | Scope |
|------|-------|-------|
| Platform | `SUPER_ADMIN` | **Cross-tenant** — platform stats, tenant portfolio, platform audit feed |
| Company | `COMPANY_ADMIN`, `ADMIN` | Tenant-wide wildcard |
| Internal | `PROJECT_MANAGER`, `SITE_ENGINEER`(=`ENGINEER`), `ACCOUNTANT`, `COMPLIANCE_OFFICER` | Module-scoped per RBAC |
| External | `CONTRACTOR`, `VENDOR` | Own assignments / records |

`SUPER_ADMIN` bypasses the tenant check (platform oversight); **platform operations
(`getPlatformStats`, `getTenants`, `getPlatformAuditFeed`) are SUPER_ADMIN-only** — even a
tenant-wildcard `COMPANY_ADMIN` is denied. All other roles keep strict tenant isolation.

**Shared widget library** (`apps/web/src/widgets.jsx`, extends the existing Tailwind system):
score gauges (Compliance / Risk / Project Health), donut charts, filterable data tables,
audit feed, notifications center, mini calendar, tasks, global search, and loading / empty /
error states. **All 8 dashboards delivered:** Super Admin, Company Admin, Project Manager
(`roleDashboards.jsx`); Site Engineer, Accountant, Compliance Officer
(`roleDashboards2.jsx`); Contractor, Vendor (`roleDashboards3.jsx`). The external roles
(Contractor/Vendor) get **scoped self-views** — `getMyContractorProfile` /
`getMyVendorProfile` return only the caller's linked record (via `User.linked_id`).

**Projects:** a `Project` entity groups `Contract` + `Site` records (`project_id` FKs); the
**Projects** tab shows a 🟢/🟡/🔴 compliance roll-up (`getProjects` derives status from
linked contract expiry + site status) plus a project registry, with a **New Project** quick
action. Contracts now carry a **`contract_type`** (Agreement / Work Order / Insurance / Other).

**Incident logs:** an `Incident` entity records safety events (Injury / Near-miss / Property
damage / Environmental / Other) with a **severity** (Low→Critical) and a **status workflow**
(Open → Investigating → Resolved → Closed). The **Incidents** tab shows a severity breakdown
plus the full register; field roles **Log Incident** (`logIncident`) and Compliance/PM
advance status (`updateIncidentStatus`). Both mutations are audit-logged; reads are
RBAC-gated (`getIncidents`).

**Environmental clearances:** a `Clearance` entity tracks statutory consents (Consent to
Operate/Establish, Environmental Clearance, Forest, CRZ, Other) with issuing authority,
reference number and **expiry-driven renewal health** — `renewal_status` is derived
server-side as 🟢 VALID / 🟡 EXPIRING (≤30d) / 🔴 EXPIRED. The **Clearances** tab shows a
roll-up + register; Compliance/PM **create** (`createClearance`) and **renew**
(`renewClearance`, extends expiry + marks RENEWED). `getExpiringClearances` powers renewal
alerts in the consolidated alerts feed. All mutations audit-logged; reads RBAC-gated.

New backend: `Contractor` model, `getDashboardSummary` (compliance/risk/health scores),
`getContractors`, `getAuditFeed`, and the platform queries — all RBAC-gated and (for
mutations) audit-logged. Seed adds a second tenant + a user per new role.

## Testing (resolver / security suite)

The API ships a resolver-testing suite focused on the multi-tenant security model:

```bash
npm test --workspace apps/api              # unit suite (no DB needed)
TEST_DATABASE_URL=postgresql://… \
MONGO_URL=mongodb://… \
  npm run test:integration --workspace apps/api   # end-to-end vs real datastores
```

What it covers (`apps/api/test/`):

| Area | File | Needs DB? |
|------|------|-----------|
| **JWT injection** — claims round-trip, tampered tokens rejected | `auth.test.js` | no |
| **Tenant isolation + RBAC** — mismatched `tenant_id` rejected, role matrix enforced | `authorize.test.js` | no |
| **Audit logging** — `{tenant_id, user_id, action, timestamp}` persisted, fails soft | `audit.test.js` | no |
| **Regression guard** — every non-public operation wires `authorize()` (a new module can't skip the check) | `rbac-coverage.test.js` | no |
| **Positive path + cross-tenant rejection + audit persistence** end-to-end | `resolvers.integration.test.js` | yes (skips otherwise) |

The integration suite is gated on `TEST_DATABASE_URL`, so the default `npm test` runs
anywhere; point it at a throwaway database to exercise the full resolver paths.

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

Vercel is static/serverless; the Express + Apollo API and its datastores do **not** run
there as-is. The repo ships everything needed to host the API as a container:

- **`apps/api/Dockerfile`** — builds the API (build it with the **repo root as context**,
  since it includes the `packages/db` workspace):
  ```bash
  docker build -f apps/api/Dockerfile -t infrasure-api .
  docker run -p 4000:4000 \
    -e DATABASE_URL=postgresql://… \
    -e MONGO_URL=mongodb+srv://… \
    -e JWT_SECRET=$(openssl rand -hex 32) \
    infrasure-api
  ```
  On start it runs `prisma db push` to apply the schema, then launches the API. The API
  boots even if MongoDB is briefly unreachable (audit logging retries and fails soft).

- **`render.yaml`** — one-click [Render](https://render.com) blueprint provisioning the
  API + the AI engine + a managed PostgreSQL. In Render: **New + → Blueprint → pick this
  repo**. `DATABASE_URL` and `JWT_SECRET` are wired automatically; set **`MONGO_URL`** to a
  free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, and optionally
  **`AI_ENGINE_URL`** to the AI engine's URL.

The same image runs on Railway, Fly.io, ECS, a VM, etc. Required env vars:
`DATABASE_URL`, `MONGO_URL`, `JWT_SECRET` (see `apps/api/.env.example` for the rest).

### Wiring the web app to the hosted API

Once the API is live at e.g. `https://infrasure-api.onrender.com`, set
**`VITE_API_URL=https://infrasure-api.onrender.com/graphql`** in Vercel → Environment
Variables and redeploy. Login and all queries will then work end-to-end.
