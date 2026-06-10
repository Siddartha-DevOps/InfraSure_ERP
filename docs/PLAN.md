# InfraSure ERP — Implementation Plan

> **InfraSure ERP — Infrastructure Assurance Platform for Construction Compliance**
> A cloud-native, multi-tenant SaaS that helps Indian construction firms stay compliant
> with contracts, finance (GST/TDS/RA bills), safety, environment, labour, RERA, and
> vendor obligations — with role-based dashboards, audit-ready logs, and AI-driven alerts.

---

## 1. Guiding principle: phased delivery

The full product (9 modules, 6 dashboards, mobile app, AI microservice, 5 external
integrations, Stripe billing) is a multi-month, multi-developer effort. We build it in
**phases**, where each phase is a working, demoable slice on top of the same target
architecture — so nothing gets thrown away.

## 2. Phased roadmap

| Phase | Scope | Outcome |
|-------|-------|---------|
| **1 — Foundation** | Monorepo, Docker (Postgres/Mongo/Redis), tenant signup, user management, JWT auth, RBAC (5 roles), audit-log writer, **Contracts module**, Portfolio + Project dashboards | A tenant can log in and manage contracts end-to-end |
| **2 — Compliance core** | Financial Compliance (GST/TDS/RA bills), Safety & Environment, Labour & RERA modules + dashboards & KPIs | The compliance heart of the product |
| **3 — Trust & money** | Vendor compliance, Risk/Dispute tracking, Audit Readiness dashboard, Stripe billing & subscription tiers | Monetization + audit-ready |
| **4 — Advanced** | React Native field app (geo-tagged DPRs, offline), Python AI engine (anomaly detection, compliance scoring), integrations (Tally/SAP, GST portal, RERA, Aadhaar e-sign, BIM) | High-value extras |

## 3. Core modules (full product)

| Module | Purpose | Key features |
|--------|---------|--------------|
| Contracts Law & Management | Manage all contracts digitally | Repository, version control, e-signatures, expiry alerts, risk scoring |
| Financial Compliance | Track GST/TDS filings & RA bills | Filing tracker, Tally/SAP sync, payment aging, invoice reconciliation |
| Safety & Environment | Site safety & environmental compliance | Digital audits, PPE checklists, pollution/waste logs |
| Labour & RERA Compliance | Labour laws & RERA filings | PF/ESI filings, wage registers, RERA updates |
| Vendor/Subcontractor Compliance | Track vendor certifications & safety | Vendor registry, certification expiry alerts |
| Risk & Dispute Tracking | Disputes & arbitration | Dispute register, escalation workflows |
| Audit Trail & Logs | Immutable audit records | Who/what/when logs, evidence attachments |
| Mobile Field Integration | On-site compliance | Geo-tagged DPRs, photo uploads, offline mode |
| AI Compliance Engine | Predict risks & automate alerts | Anomaly detection, predictive compliance scoring |

## 4. Dashboards

| Dashboard | Purpose |
|-----------|---------|
| Portfolio | Overview of all projects' compliance status |
| Project | Detailed compliance metrics per project |
| Real-Time Monitoring | Live KPIs, alerts, geo-tagged map |
| Compliance Alerts | Critical vs warning alerts, resolution workflow |
| Role-Based | Engineer, Accountant, Compliance Officer, Project Manager views |
| Audit Readiness | Documents verified, pending approvals, compliance score |

## 5. KPIs to track

Contract approval rate · RA bill approval time · GST/TDS filing compliance ·
Safety audit completion % · Environmental clearance renewal % · PF/ESI filing rate ·
Vendor certification rate · Audit readiness score · Average alert resolution time.

## 6. Phase 1 — concrete deliverable

- Running monorepo via `docker-compose up` (Postgres + MongoDB + Redis).
- **Schema:** `tenants`, `users`, `roles`, `subscriptions`, `contracts` (PostgreSQL) +
  `audit_logs` (MongoDB).
- **Auth flow:** company signs up → tenant created → admin user created → login returns a
  JWT carrying `tenant_id` + `role`.
- **RBAC:** 5 roles (Engineer, Accountant, Compliance Officer, Project Manager, Admin) with
  JSON-defined permissions, enforced in middleware.
- **Contracts module:** create / list / version contracts, expiry alerts, document upload
  (local in dev, S3-ready), every action audit-logged.
- **Web UI:** login, role-based navigation, Portfolio + Project dashboards, Contracts screens.
- **Seed data:** one demo tenant + a user per role to click through immediately.

## 7. Decisions (Phase 1)

- **API:** GraphQL for data/dashboard queries; REST only for file uploads.
- **Dev file storage:** local disk now, S3 adapter ready for later.
- **ORM:** Prisma for the PostgreSQL schema & migrations.
- **Auth:** email/password + JWT in Phase 1; OAuth2/OIDC SSO and Aadhaar e-sign in Phase 4.

## 8. Open inputs from product owner

- GraphQL schema design (to align Phase 1 schema/resolvers).
- Role-based GraphQL workflow (to align RBAC and per-role access).

These are incorporated into `docs/ARCHITECTURE.md` once provided.
