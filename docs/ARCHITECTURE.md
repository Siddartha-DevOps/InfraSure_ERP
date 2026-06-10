# InfraSure ERP — Architecture

Multi-tenant SaaS for construction-compliance management. This document captures the target
architecture and the multi-tenant / RBAC design that Phase 1 implements.

---

## 1. Tech stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend (web) | React + Vite + TailwindCSS | Role-based dashboards, reusable components |
| Mobile | React Native | DPR uploads, geo-tagging, offline sync (Phase 4) |
| Backend API | Node.js + Express + GraphQL | GraphQL for queries; REST for file uploads & integrations |
| Auth | JWT (tenant_id + role claims); OAuth2/OIDC SSO later | RBAC middleware |
| Structured DB | PostgreSQL (Prisma) | Contracts, filings, KPIs — `tenant_id` on every table |
| Audit DB | MongoDB | Immutable, tenant-scoped audit logs + evidence metadata |
| Cache / queue | Redis | Caching + alerts queue |
| AI layer | Python (FastAPI) microservice | Predictive scoring, anomaly detection, OCR (Phase 4) |
| Billing | Stripe | Subscription tiers, billing tied to tenant (Phase 3) |
| Integrations | Tally/SAP, GST Portal, Aadhaar e-sign, RERA, BIM | Phase 4 |

## 2. Monorepo layout

```
infrasure-erp/
├── apps/
│   ├── web/            React + Vite + TailwindCSS
│   ├── api/            Node.js + Express + GraphQL
│   └── mobile/         React Native (Phase 4)
├── services/
│   └── ai-engine/      Python FastAPI (Phase 4)
├── packages/
│   ├── db/             Prisma schema + migrations (PostgreSQL)
│   ├── auth/           JWT + RBAC middleware
│   └── shared/         shared types/utils
├── infra/              docker-compose (Postgres, MongoDB, Redis)
└── docs/               PLAN.md, ARCHITECTURE.md
```

## 3. Multi-tenancy model

**Shared-schema multi-tenancy** with a `tenant_id` column on every business table
(recommended for cost-efficiency and easy upgrades, like Procore / Oracle Aconex).

Isolation is enforced in **two layers**:

1. **Data layer** — every query is automatically scoped by the `tenant_id` taken from the
   authenticated JWT. No query crosses tenant boundaries.
2. **RBAC layer** — middleware checks the user's role permissions before resolving a request.

Encryption: AES-256 at rest, TLS in transit. Audit logs are tenant-scoped and immutable in
MongoDB.

## 4. Accounts & roles

- **Tenant (company):** company_name, gst_number, rera_id, subscription_plan.
- **User:** belongs to exactly one tenant; has one role.
- **Roles:** Engineer, Accountant, Compliance Officer, Project Manager, Admin — each with a
  JSON permission set for fine-grained RBAC.
- **Auth token:** JWT includes `tenant_id` + `role`; all GraphQL queries filter by these.

## 5. Phase 1 data model (initial)

### PostgreSQL

- **tenants** — `tenant_id` (PK), company_name, gst_number, rera_id, subscription_plan,
  created_at, updated_at
- **roles** — `role_id` (PK), role_name, permissions (JSON)
- **users** — `user_id` (PK), `tenant_id` (FK), email, password_hash, `role_id` (FK),
  status, created_at, last_login
- **subscriptions** — `subscription_id` (PK), `tenant_id` (FK), plan_type, billing_cycle,
  stripe_customer_id, status
- **contracts** — `contract_id` (PK), `tenant_id` (FK), title, expiry_date, status,
  document_url, version, created_at, updated_at

### MongoDB

- **audit_logs** — log_id, tenant_id, user_id, action (upload/approve/modify), timestamp,
  metadata (JSON)

## 6. Example end-to-end flow

1. Company signs up → tenant record created in PostgreSQL.
2. Admin adds users → Engineer, Accountant, Compliance Officer, Project Manager.
3. User logs in → JWT issued with `tenant_id` + `role`.
4. Dashboards load → GraphQL queries auto-filtered by `tenant_id` + role permissions.
5. (Phase 3) Billing cycle runs → Stripe charges the tenant account.

## 7. To be finalized from product-owner docs

- Full GraphQL SDL (types, queries, mutations, subscriptions).
- Role-based GraphQL workflow: which role can run which query/mutation, and field-level
  access rules.

These will be merged into sections 4–6 once the product owner provides the schema and
workflow docs.
