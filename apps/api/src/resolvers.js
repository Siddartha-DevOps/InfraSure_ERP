// GraphQL resolvers for InfraSure ERP (Phase 1).
// Every resolver enforces tenant isolation + RBAC via authorize(), and every
// mutation writes an audit log to MongoDB.
import { GraphQLError } from "graphql";
import prisma from "@infrasure/db";
import { authorize } from "./rbac.js";
import { writeAuditLog, readAuditLogs } from "./mongo.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
} from "./auth.js";
import { listTiers, createCheckoutSession, isValidPlan } from "./billing.js";
import { extractGeoFromReport, isSameSite } from "./geo.js";
import { getInsights } from "./ai.js";
import {
  integrationStatus,
  syncTallyLedger,
  fileGstReturnExternal,
  syncReraUpdates,
  requestAadhaarEsign,
  importBimModel,
} from "./integrations/index.js";

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

function notFound(entity) {
  return new GraphQLError(`${entity} not found`, {
    extensions: { code: "NOT_FOUND" },
  });
}

export const resolvers = {
  // Date fields are stored as DateTime but exposed as ISO strings.
  Contract: { expiry_date: (c) => iso(c.expiry_date) },
  Finance: {
    due_date: (f) => iso(f.due_date),
    paid_date: (f) => iso(f.paid_date),
  },
  Safety: { audit_date: (s) => iso(s.audit_date) },
  Dpr: { created_at: (d) => iso(d.created_at) },
  EnvironmentalReport: { created_at: (e) => iso(e.created_at) },
  EnvironmentalLog: { recorded_at: (e) => iso(e.recorded_at) },
  LabourFiling: { filed_date: (l) => iso(l.filed_date) },
  ReraFiling: {
    due_date: (r) => iso(r.due_date),
    filed_date: (r) => iso(r.filed_date),
  },
  Vendor: { certification_expiry: (v) => iso(v.certification_expiry) },
  Dispute: {
    opened_at: (d) => iso(d.opened_at),
    resolved_at: (d) => iso(d.resolved_at),
  },
  Subscription: { current_period_end: (s) => iso(s.current_period_end) },

  Query: {
    me: async (_p, _a, { user }) => {
      if (!user) return null;
      return prisma.user.findUnique({ where: { user_id: user.user_id } });
    },

    getTenant: async (_p, args, { user }) => {
      authorize("getTenant", args, user);
      return prisma.tenant.findUnique({ where: { tenant_id: args.tenant_id } });
    },

    getUsers: async (_p, args, { user }) => {
      authorize("getUsers", args, user);
      return prisma.user.findMany({ where: { tenant_id: args.tenant_id } });
    },

    getContracts: async (_p, args, { user }) => {
      authorize("getContracts", args, user);
      return prisma.contract.findMany({ where: { tenant_id: args.tenant_id } });
    },

    // Expiry alerts: contracts whose expiry_date falls within the next N days
    // (defaults to 30), soonest first. Excludes already-expired by default? No —
    // include from now forward so imminent + just-lapsed both surface.
    getExpiringContracts: async (_p, args, { user }) => {
      authorize("getExpiringContracts", args, user);
      const withinDays = args.withinDays ?? 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + withinDays);
      return prisma.contract.findMany({
        where: {
          tenant_id: args.tenant_id,
          expiry_date: { lte: cutoff },
        },
        orderBy: { expiry_date: "asc" },
      });
    },

    getFinanceRecords: async (_p, args, { user }) => {
      authorize("getFinanceRecords", args, user);
      return prisma.finance.findMany({ where: { tenant_id: args.tenant_id } });
    },

    getSafetyAudits: async (_p, args, { user }) => {
      authorize("getSafetyAudits", args, user);
      return prisma.safety.findMany({ where: { tenant_id: args.tenant_id } });
    },

    getEnvironmentalLogs: async (_p, args, { user }) => {
      authorize("getEnvironmentalLogs", args, user);
      return prisma.environmentalLog.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { recorded_at: "desc" },
      });
    },

    getLabourFilings: async (_p, args, { user }) => {
      authorize("getLabourFilings", args, user);
      return prisma.labourFiling.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
    },

    getReraFilings: async (_p, args, { user }) => {
      authorize("getReraFilings", args, user);
      return prisma.reraFiling.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { due_date: "asc" },
      });
    },

    // Computes the Phase 2 compliance KPIs from live data for one tenant.
    getComplianceKPIs: async (_p, args, { user }) => {
      authorize("getComplianceKPIs", args, user);
      const where = { tenant_id: args.tenant_id };
      const [finances, safety, labour, rera] = await Promise.all([
        prisma.finance.findMany({ where }),
        prisma.safety.findMany({ where }),
        prisma.labourFiling.findMany({ where }),
        prisma.reraFiling.findMany({ where }),
      ]);

      // pct(matching, total) → percentage, 100 when there's nothing to track.
      const pct = (n, total) => (total === 0 ? 100 : (n / total) * 100);
      const round = (x) => Math.round(x * 10) / 10;

      const gst = pct(
        finances.filter((f) => f.gst_filing_status === "FILED").length,
        finances.length
      );
      const tds = pct(
        finances.filter((f) => f.tds_status === "FILED").length,
        finances.length
      );
      const ra = pct(
        finances.filter((f) => f.ra_bill_status === "APPROVED").length,
        finances.length
      );
      const safetyDone = pct(
        safety.filter((s) => s.checklist_status === "COMPLETED").length,
        safety.length
      );
      const avgPpe =
        safety.length === 0
          ? 0
          : safety.reduce((a, s) => a + (s.ppe_compliance || 0), 0) /
            safety.length;
      const pfEsi = pct(
        labour.filter((l) => l.status === "FILED").length,
        labour.length
      );
      const reraRate = pct(
        rera.filter((r) => r.status === "FILED" || r.status === "APPROVED")
          .length,
        rera.length
      );
      const now = new Date();
      const overdue = finances.filter(
        (f) => !f.paid_date && new Date(f.due_date) < now
      ).length;

      // Audit-readiness score: simple average of the compliance percentages.
      const readiness =
        (gst + tds + ra + safetyDone + pfEsi + reraRate) / 6;

      return {
        gst_filing_compliance: round(gst),
        tds_filing_compliance: round(tds),
        ra_bill_approval_rate: round(ra),
        safety_audit_completion: round(safetyDone),
        avg_ppe_compliance: round(avgPpe),
        pf_esi_filing_rate: round(pfEsi),
        rera_filing_rate: round(reraRate),
        overdue_payments: overdue,
        audit_readiness_score: round(readiness),
      };
    },

    // ---- Phase 3: Vendors / Disputes / Billing / Audit readiness ----
    getVendors: async (_p, args, { user }) => {
      authorize("getVendors", args, user);
      return prisma.vendor.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
    },

    getExpiringCertifications: async (_p, args, { user }) => {
      authorize("getExpiringCertifications", args, user);
      const withinDays = args.withinDays ?? 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + withinDays);
      return prisma.vendor.findMany({
        where: {
          tenant_id: args.tenant_id,
          certification_expiry: { not: null, lte: cutoff },
        },
        orderBy: { certification_expiry: "asc" },
      });
    },

    getDisputes: async (_p, args, { user }) => {
      authorize("getDisputes", args, user);
      return prisma.dispute.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { opened_at: "desc" },
      });
    },

    getSubscription: async (_p, args, { user }) => {
      authorize("getSubscription", args, user);
      return prisma.subscription.findFirst({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
    },

    getBillingTiers: async (_p, _args, { user }) => {
      // Any authenticated user may view plans; no tenant arg to scope.
      authorize("getBillingTiers", {}, user);
      return listTiers();
    },

    // Rolls up document/approval/dispute/vendor signals into a readiness score.
    getAuditReadiness: async (_p, args, { user }) => {
      authorize("getAuditReadiness", args, user);
      const where = { tenant_id: args.tenant_id };
      const [contracts, steps, finances, labour, rera, vendors, disputes] =
        await Promise.all([
          prisma.contract.findMany({ where }),
          prisma.workflowStep.findMany({ where }),
          prisma.finance.findMany({ where }),
          prisma.labourFiling.findMany({ where }),
          prisma.reraFiling.findMany({ where }),
          prisma.vendor.findMany({ where }),
          prisma.dispute.findMany({ where }),
        ]);

      const round = (x) => Math.round(x * 10) / 10;
      const documents_total = contracts.length;
      const documents_verified = contracts.filter((c) => c.document_url).length;

      const pending_approvals =
        steps.filter((s) => s.status === "PENDING").length +
        finances.filter((f) => f.ra_bill_status !== "APPROVED").length +
        labour.filter((l) => l.status !== "FILED").length +
        rera.filter((r) => r.status === "PENDING").length;

      const open_disputes = disputes.filter(
        (d) => d.status !== "RESOLVED"
      ).length;

      const now = new Date();
      const vendorValid = vendors.filter(
        (v) =>
          v.status === "ACTIVE" &&
          (!v.certification_expiry || new Date(v.certification_expiry) >= now)
      ).length;
      const vendor_compliance_rate =
        vendors.length === 0 ? 100 : (vendorValid / vendors.length) * 100;

      // Readiness: documents verified, vendor compliance, and penalties for
      // pending approvals and open disputes (each capped so score stays 0–100).
      const docScore =
        documents_total === 0 ? 100 : (documents_verified / documents_total) * 100;
      const approvalPenalty = Math.min(pending_approvals * 5, 40);
      const disputePenalty = Math.min(open_disputes * 5, 30);
      const score = Math.max(
        0,
        (docScore + vendor_compliance_rate) / 2 - approvalPenalty - disputePenalty
      );

      return {
        documents_verified,
        documents_total,
        pending_approvals,
        open_disputes,
        vendor_compliance_rate: round(vendor_compliance_rate),
        audit_readiness_score: round(score),
      };
    },

    // ---- Phase 4: AI insights ----
    getAIInsights: async (_p, args, { user }) => {
      authorize("getAIInsights", args, user);
      const where = { tenant_id: args.tenant_id };
      const [finances, safety, labour, rera] = await Promise.all([
        prisma.finance.findMany({ where }),
        prisma.safety.findMany({ where }),
        prisma.labourFiling.findMany({ where }),
        prisma.reraFiling.findMany({ where }),
      ]);

      const pct = (n, total) => (total === 0 ? 100 : (n / total) * 100);
      const now = new Date();
      const metrics = {
        gst_filing_compliance: pct(
          finances.filter((f) => f.gst_filing_status === "FILED").length,
          finances.length
        ),
        tds_filing_compliance: pct(
          finances.filter((f) => f.tds_status === "FILED").length,
          finances.length
        ),
        ra_bill_approval_rate: pct(
          finances.filter((f) => f.ra_bill_status === "APPROVED").length,
          finances.length
        ),
        safety_audit_completion: pct(
          safety.filter((s) => s.checklist_status === "COMPLETED").length,
          safety.length
        ),
        pf_esi_filing_rate: pct(
          labour.filter((l) => l.status === "FILED").length,
          labour.length
        ),
        rera_filing_rate: pct(
          rera.filter((r) => r.status === "FILED" || r.status === "APPROVED").length,
          rera.length
        ),
      };

      // Records the AI engine scans for anomalies (amount outliers + overdue-unpaid).
      const records = finances.map((f) => ({
        finance_id: f.finance_id,
        amount: f.amount,
        paid_date: f.paid_date ? f.paid_date.toISOString() : null,
        overdue: !f.paid_date && new Date(f.due_date) < now,
      }));

      return getInsights({ records, metrics });
    },

    // ---- Phase 4: Integration status ----
    getIntegrationStatus: async (_p, args, { user }) => {
      authorize("getIntegrationStatus", args, user);
      return integrationStatus();
    },

    // ---- Dashboards ----
    getDPRs: async (_p, args, { user }) => {
      authorize("getDPRs", args, user);
      return prisma.dpr.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
    },

    getWorkflowSteps: async (_p, args, { user }) => {
      authorize("getWorkflowSteps", args, user);
      return prisma.workflowStep.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
    },

    getSites: async (_p, args, { user }) => {
      authorize("getSites", args, user);
      return prisma.site.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
    },

    // ---- Dashboard role architecture ----
    getContractors: async (_p, args, { user }) => {
      authorize("getContractors", args, user);
      return prisma.contractor.findMany({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
    },

    getAuditFeed: async (_p, args, { user }) => {
      authorize("getAuditFeed", args, user);
      return readAuditLogs({ tenant_id: args.tenant_id, limit: args.limit ?? 15 });
    },

    // Composite scores for the shared score widgets (compliance / risk / health).
    getDashboardSummary: async (_p, args, { user }) => {
      authorize("getDashboardSummary", args, user);
      const where = { tenant_id: args.tenant_id };
      const now = new Date();
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);

      const [finances, safety, labour, rera, disputes, contracts, vendors, steps] =
        await Promise.all([
          prisma.finance.findMany({ where }),
          prisma.safety.findMany({ where }),
          prisma.labourFiling.findMany({ where }),
          prisma.reraFiling.findMany({ where }),
          prisma.dispute.findMany({ where }),
          prisma.contract.findMany({ where }),
          prisma.vendor.findMany({ where }),
          prisma.workflowStep.findMany({ where }),
        ]);

      const pct = (n, total) => (total === 0 ? 100 : (n / total) * 100);
      const round = (x) => Math.round(x * 10) / 10;

      // Compliance: average of the key filing/audit rates.
      const compliance =
        (pct(finances.filter((f) => f.gst_filing_status === "FILED").length, finances.length) +
          pct(finances.filter((f) => f.tds_status === "FILED").length, finances.length) +
          pct(safety.filter((s) => s.checklist_status === "COMPLETED").length, safety.length) +
          pct(labour.filter((l) => l.status === "FILED").length, labour.length) +
          pct(rera.filter((r) => r.status === "FILED" || r.status === "APPROVED").length, rera.length)) /
        5;

      const overdue = finances.filter((f) => !f.paid_date && new Date(f.due_date) < now).length;
      const openDisputes = disputes.filter((d) => d.status !== "RESOLVED").length;
      const escalated = disputes.filter((d) => d.status === "ESCALATED").length;
      const pendingSteps = steps.filter((s) => s.status === "PENDING").length;
      const expContracts = contracts.filter(
        (c) => new Date(c.expiry_date) <= soon
      ).length;
      const expCerts = vendors.filter(
        (v) => v.certification_expiry && new Date(v.certification_expiry) <= soon
      ).length;

      // Risk: weighted penalties (0 = no risk, 100 = max).
      const risk = Math.min(
        100,
        overdue * 8 + escalated * 15 + openDisputes * 6 + expContracts * 4 + expCerts * 4 + (100 - compliance) * 0.3
      );
      const health = Math.max(0, compliance - risk * 0.4 - pendingSteps * 2);
      const openAlerts = overdue + openDisputes + expContracts + expCerts;

      return {
        compliance_score: round(compliance),
        risk_score: round(risk),
        project_health_score: round(health),
        open_alerts: openAlerts,
        expiring_contracts: expContracts,
        expiring_certificates: expCerts,
      };
    },

    // ---- Platform (SUPER_ADMIN, cross-tenant) ----
    getPlatformStats: async (_p, _args, { user }) => {
      authorize("getPlatformStats", {}, user);
      const TIER_MRR = { BASIC: 0, PRO: 4999, ENTERPRISE: 19999 };
      const [tenants, users, contracts, subs, finances, disputes] =
        await Promise.all([
          prisma.tenant.findMany(),
          prisma.user.count(),
          prisma.contract.count(),
          prisma.subscription.findMany(),
          prisma.finance.findMany(),
          prisma.dispute.findMany(),
        ]);
      const activeSubs = subs.filter((s) => s.status === "ACTIVE");
      const mrr = activeSubs.reduce((a, s) => a + (TIER_MRR[s.plan_type] ?? 0), 0);
      const filed = finances.filter(
        (f) => f.gst_filing_status === "FILED"
      ).length;
      const avgCompliance =
        finances.length === 0 ? 100 : (filed / finances.length) * 100;
      return {
        total_tenants: tenants.length,
        total_users: users,
        total_contracts: contracts,
        active_subscriptions: activeSubs.length,
        mrr_inr: mrr,
        avg_compliance: Math.round(avgCompliance * 10) / 10,
        open_disputes: disputes.filter((d) => d.status !== "RESOLVED").length,
      };
    },

    getTenants: async (_p, _args, { user }) => {
      authorize("getTenants", {}, user);
      const tenants = await prisma.tenant.findMany({
        include: { _count: { select: { users: true, contracts: true } } },
        orderBy: { created_at: "asc" },
      });
      // Compute a simple compliance score per tenant from filed GST.
      const finances = await prisma.finance.findMany();
      return tenants.map((tn) => {
        const tf = finances.filter((f) => f.tenant_id === tn.tenant_id);
        const filed = tf.filter((f) => f.gst_filing_status === "FILED").length;
        const score = tf.length === 0 ? 100 : Math.round((filed / tf.length) * 100);
        return {
          tenant_id: tn.tenant_id,
          company_name: tn.company_name,
          subscription_plan: tn.subscription_plan,
          user_count: tn._count.users,
          contract_count: tn._count.contracts,
          compliance_score: score,
          status: "ACTIVE",
        };
      });
    },

    getPlatformAuditFeed: async (_p, args, { user }) => {
      authorize("getPlatformAuditFeed", {}, user);
      return readAuditLogs({ limit: args.limit ?? 20 });
    },
  },

  Mutation: {
    // ---- Auth (public; no tenant/RBAC check) ----
    signupTenant: async (_p, args) => {
      const existing = await prisma.user.findUnique({
        where: { email: args.admin_email },
      });
      if (existing) {
        throw new GraphQLError("Email already registered", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const tenant = await prisma.tenant.create({
        data: {
          company_name: args.company_name,
          gst_number: args.gst_number ?? null,
          rera_id: args.rera_id ?? null,
          subscriptions: { create: {} },
        },
      });
      const user = await prisma.user.create({
        data: {
          tenant_id: tenant.tenant_id,
          email: args.admin_email,
          password_hash: await hashPassword(args.admin_password),
          role: "ADMIN",
        },
      });
      await writeAuditLog({
        tenant_id: tenant.tenant_id,
        user_id: user.user_id,
        action: "signupTenant",
        metadata: { company_name: tenant.company_name },
      });
      return { token: signToken(user), user, tenant };
    },

    login: async (_p, { email, password }) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        throw new GraphQLError("Invalid credentials", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: { last_login: new Date() },
      });
      const tenant = await prisma.tenant.findUnique({
        where: { tenant_id: user.tenant_id },
      });
      return { token: signToken(user), user, tenant };
    },

    // ---- Contracts ----
    createContract: async (_p, args, { user }) => {
      authorize("createContract", args, user);
      const contract = await prisma.contract.create({
        data: {
          tenant_id: args.tenant_id,
          title: args.title,
          expiry_date: new Date(args.expiry_date),
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createContract",
        metadata: { contract_id: contract.contract_id, title: contract.title },
      });
      return contract;
    },

    updateContractStatus: async (_p, args, { user }) => {
      authorize("updateContractStatus", args, user);
      const found = await prisma.contract.findFirst({
        where: { contract_id: args.contract_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("Contract");
      const contract = await prisma.contract.update({
        where: { contract_id: args.contract_id },
        data: { status: args.status, version: { increment: 1 } },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "updateContractStatus",
        metadata: { contract_id: args.contract_id, status: args.status },
      });
      return contract;
    },

    // ---- Finance ----
    createFinanceRecord: async (_p, args, { user }) => {
      authorize("createFinanceRecord", args, user);
      const record = await prisma.finance.create({
        data: {
          tenant_id: args.tenant_id,
          amount: args.amount,
          due_date: new Date(args.due_date),
          invoice_number: args.invoice_number ?? null,
          filing_period: args.filing_period ?? null,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createFinanceRecord",
        metadata: { finance_id: record.finance_id, amount: record.amount },
      });
      return record;
    },

    fileGST: async (_p, args, { user }) => {
      authorize("fileGST", args, user);
      const record = await prisma.finance.findFirst({
        where: { finance_id: args.finance_id, tenant_id: args.tenant_id },
      });
      if (!record) throw notFound("Finance record");
      const updated = await prisma.finance.update({
        where: { finance_id: args.finance_id },
        data: { gst_filing_status: "FILED" },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "fileGST",
        metadata: { finance_id: args.finance_id },
      });
      return updated;
    },

    fileTDS: async (_p, args, { user }) => {
      authorize("fileTDS", args, user);
      const record = await prisma.finance.findFirst({
        where: { finance_id: args.finance_id, tenant_id: args.tenant_id },
      });
      if (!record) throw notFound("Finance record");
      const updated = await prisma.finance.update({
        where: { finance_id: args.finance_id },
        data: { tds_status: "FILED" },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "fileTDS",
        metadata: { finance_id: args.finance_id },
      });
      return updated;
    },

    approveRABill: async (_p, args, { user }) => {
      authorize("approveRABill", args, user);
      const record = await prisma.finance.findFirst({
        where: { finance_id: args.finance_id, tenant_id: args.tenant_id },
      });
      if (!record) throw notFound("Finance record");
      const updated = await prisma.finance.update({
        where: { finance_id: args.finance_id },
        data: { ra_bill_status: "APPROVED" },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "approveRABill",
        metadata: { finance_id: args.finance_id },
      });
      return updated;
    },

    recordPayment: async (_p, args, { user }) => {
      authorize("recordPayment", args, user);
      const record = await prisma.finance.findFirst({
        where: { finance_id: args.finance_id, tenant_id: args.tenant_id },
      });
      if (!record) throw notFound("Finance record");
      const updated = await prisma.finance.update({
        where: { finance_id: args.finance_id },
        data: { paid_date: new Date() },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "recordPayment",
        metadata: { finance_id: args.finance_id },
      });
      return updated;
    },

    // ---- Safety / field ----
    logSafetyAudit: async (_p, args, { user }) => {
      authorize("logSafetyAudit", args, user);
      const audit = await prisma.safety.create({
        data: {
          tenant_id: args.tenant_id,
          checklist_status: args.checklist_status,
          site_name: args.site_name ?? null,
          ppe_compliance: args.ppe_compliance ?? 0,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "logSafetyAudit",
        metadata: { safety_id: audit.safety_id },
      });
      return audit;
    },

    createDPR: async (_p, args, { user }) => {
      authorize("createDPR", args, user);
      const dpr = await prisma.dpr.create({
        data: { tenant_id: args.tenant_id, report_data: args.report_data },
      });

      // Geo-tagged DPRs (mobile) auto-populate the project map: reuse a site
      // within ~100m, otherwise create one. Failures never break the DPR.
      let site_id = null;
      const geo = extractGeoFromReport(args.report_data);
      if (geo) {
        try {
          const sites = await prisma.site.findMany({
            where: { tenant_id: args.tenant_id },
          });
          const existing = sites.find((s) => isSameSite(geo, s));
          const site =
            existing ??
            (await prisma.site.create({
              data: {
                tenant_id: args.tenant_id,
                name: geo.name,
                latitude: geo.lat,
                longitude: geo.lng,
              },
            }));
          site_id = site.site_id;
        } catch (err) {
          console.error("[geo] site upsert failed:", err.message);
        }
      }

      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createDPR",
        metadata: { dpr_id: dpr.dpr_id, ...(site_id ? { site_id } : {}) },
      });
      return dpr;
    },

    // ---- Compliance / environment ----
    logEnvironmentalReport: async (_p, args, { user }) => {
      authorize("logEnvironmentalReport", args, user);
      const report = await prisma.environmentalReport.create({
        data: { tenant_id: args.tenant_id, report_data: args.report_data },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "logEnvironmentalReport",
        metadata: { report_id: report.report_id },
      });
      return report;
    },

    logEnvironmentalLog: async (_p, args, { user }) => {
      authorize("logEnvironmentalLog", args, user);
      const log = await prisma.environmentalLog.create({
        data: {
          tenant_id: args.tenant_id,
          log_type: args.log_type,
          reading: args.reading,
          unit: args.unit ?? "",
          notes: args.notes ?? null,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "logEnvironmentalLog",
        metadata: { env_log_id: log.env_log_id, log_type: log.log_type },
      });
      return log;
    },

    // ---- Labour & RERA ----
    createLabourFiling: async (_p, args, { user }) => {
      authorize("createLabourFiling", args, user);
      const filing = await prisma.labourFiling.create({
        data: {
          tenant_id: args.tenant_id,
          filing_type: args.filing_type,
          period: args.period,
          worker_count: args.worker_count ?? 0,
          amount: args.amount ?? 0,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createLabourFiling",
        metadata: { labour_id: filing.labour_id, filing_type: filing.filing_type },
      });
      return filing;
    },

    updateLabourFilingStatus: async (_p, args, { user }) => {
      authorize("updateLabourFilingStatus", args, user);
      const found = await prisma.labourFiling.findFirst({
        where: { labour_id: args.labour_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("Labour filing");
      const filing = await prisma.labourFiling.update({
        where: { labour_id: args.labour_id },
        data: {
          status: args.status,
          filed_date: args.status === "FILED" ? new Date() : found.filed_date,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "updateLabourFilingStatus",
        metadata: { labour_id: args.labour_id, status: args.status },
      });
      return filing;
    },

    createReraFiling: async (_p, args, { user }) => {
      authorize("createReraFiling", args, user);
      const filing = await prisma.reraFiling.create({
        data: {
          tenant_id: args.tenant_id,
          project_name: args.project_name,
          due_date: new Date(args.due_date),
          filing_type: args.filing_type ?? "QUARTERLY_UPDATE",
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createReraFiling",
        metadata: { filing_id: filing.filing_id, project_name: filing.project_name },
      });
      return filing;
    },

    updateReraFilingStatus: async (_p, args, { user }) => {
      authorize("updateReraFilingStatus", args, user);
      const found = await prisma.reraFiling.findFirst({
        where: { filing_id: args.filing_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("RERA filing");
      const filing = await prisma.reraFiling.update({
        where: { filing_id: args.filing_id },
        data: {
          status: args.status,
          filed_date:
            args.status === "FILED" || args.status === "APPROVED"
              ? found.filed_date ?? new Date()
              : found.filed_date,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "updateReraFilingStatus",
        metadata: { filing_id: args.filing_id, status: args.status },
      });
      return filing;
    },

    // ---- Project management ----
    approveWorkflowStep: async (_p, args, { user }) => {
      authorize("approveWorkflowStep", args, user);
      const step = await prisma.workflowStep.findFirst({
        where: { step_id: args.step_id, tenant_id: args.tenant_id },
      });
      if (!step) throw notFound("Workflow step");
      const updated = await prisma.workflowStep.update({
        where: { step_id: args.step_id },
        data: { status: "APPROVED" },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "approveWorkflowStep",
        metadata: { step_id: args.step_id },
      });
      return updated;
    },

    assignUserRole: async (_p, args, { user }) => {
      authorize("assignUserRole", args, user);
      const target = await prisma.user.findFirst({
        where: { user_id: args.user_id, tenant_id: args.tenant_id },
      });
      if (!target) throw notFound("User");
      const updated = await prisma.user.update({
        where: { user_id: args.user_id },
        data: { role: args.role },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "assignUserRole",
        metadata: { target_user_id: args.user_id, role: args.role },
      });
      return updated;
    },

    // ---- Phase 3: Vendors ----
    createVendor: async (_p, args, { user }) => {
      authorize("createVendor", args, user);
      const vendor = await prisma.vendor.create({
        data: {
          tenant_id: args.tenant_id,
          name: args.name,
          gst_number: args.gst_number ?? null,
          certification_name: args.certification_name ?? null,
          certification_expiry: args.certification_expiry
            ? new Date(args.certification_expiry)
            : null,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createVendor",
        metadata: { vendor_id: vendor.vendor_id, name: vendor.name },
      });
      return vendor;
    },

    updateVendorStatus: async (_p, args, { user }) => {
      authorize("updateVendorStatus", args, user);
      const found = await prisma.vendor.findFirst({
        where: { vendor_id: args.vendor_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("Vendor");
      const vendor = await prisma.vendor.update({
        where: { vendor_id: args.vendor_id },
        data: { status: args.status },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "updateVendorStatus",
        metadata: { vendor_id: args.vendor_id, status: args.status },
      });
      return vendor;
    },

    // ---- Phase 3: Disputes ----
    createDispute: async (_p, args, { user }) => {
      authorize("createDispute", args, user);
      const dispute = await prisma.dispute.create({
        data: {
          tenant_id: args.tenant_id,
          title: args.title,
          dispute_type: args.dispute_type ?? "CONTRACT",
          counterparty: args.counterparty ?? null,
          amount: args.amount ?? 0,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createDispute",
        metadata: { dispute_id: dispute.dispute_id, title: dispute.title },
      });
      return dispute;
    },

    updateDisputeStatus: async (_p, args, { user }) => {
      authorize("updateDisputeStatus", args, user);
      const found = await prisma.dispute.findFirst({
        where: { dispute_id: args.dispute_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("Dispute");
      const dispute = await prisma.dispute.update({
        where: { dispute_id: args.dispute_id },
        data: {
          status: args.status,
          resolved_at:
            args.status === "RESOLVED" ? new Date() : found.resolved_at,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "updateDisputeStatus",
        metadata: { dispute_id: args.dispute_id, status: args.status },
      });
      return dispute;
    },

    escalateDispute: async (_p, args, { user }) => {
      authorize("escalateDispute", args, user);
      const found = await prisma.dispute.findFirst({
        where: { dispute_id: args.dispute_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("Dispute");
      const dispute = await prisma.dispute.update({
        where: { dispute_id: args.dispute_id },
        data: {
          status: "ESCALATED",
          escalation_level: { increment: 1 },
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "escalateDispute",
        metadata: {
          dispute_id: args.dispute_id,
          escalation_level: dispute.escalation_level,
        },
      });
      return dispute;
    },

    // ---- Phase 3: Billing ----
    changeSubscriptionPlan: async (_p, args, { user }) => {
      authorize("changeSubscriptionPlan", args, user);
      if (!isValidPlan(args.plan_type)) {
        throw new GraphQLError(`Unknown plan: ${args.plan_type}`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const sub = await prisma.subscription.findFirst({
        where: { tenant_id: args.tenant_id },
        orderBy: { created_at: "desc" },
      });
      if (!sub) throw notFound("Subscription");
      const updated = await prisma.subscription.update({
        where: { subscription_id: sub.subscription_id },
        data: { plan_type: args.plan_type },
      });
      // Keep the tenant's denormalized plan label in sync.
      await prisma.tenant.update({
        where: { tenant_id: args.tenant_id },
        data: { subscription_plan: args.plan_type },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "changeSubscriptionPlan",
        metadata: { plan_type: args.plan_type },
      });
      return updated;
    },

    createBillingCheckout: async (_p, args, { user }) => {
      authorize("createBillingCheckout", args, user);
      if (!isValidPlan(args.plan_type)) {
        throw new GraphQLError(`Unknown plan: ${args.plan_type}`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const dbUser = await prisma.user.findUnique({
        where: { user_id: user.user_id },
      });
      const session = await createCheckoutSession({
        plan_type: args.plan_type,
        customer_email: dbUser?.email,
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createBillingCheckout",
        metadata: { plan_type: args.plan_type, driver: session.driver },
      });
      return session;
    },

    // ---- Contractors ----
    createContractor: async (_p, args, { user }) => {
      authorize("createContractor", args, user);
      const contractor = await prisma.contractor.create({
        data: {
          tenant_id: args.tenant_id,
          name: args.name,
          trade: args.trade ?? null,
          contact_email: args.contact_email ?? null,
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createContractor",
        metadata: { contractor_id: contractor.contractor_id, name: contractor.name },
      });
      return contractor;
    },

    updateContractorStatus: async (_p, args, { user }) => {
      authorize("updateContractorStatus", args, user);
      const found = await prisma.contractor.findFirst({
        where: { contractor_id: args.contractor_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("Contractor");
      const contractor = await prisma.contractor.update({
        where: { contractor_id: args.contractor_id },
        data: { status: args.status },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "updateContractorStatus",
        metadata: { contractor_id: args.contractor_id, status: args.status },
      });
      return contractor;
    },

    // ---- Sites (geo map) ----
    createSite: async (_p, args, { user }) => {
      authorize("createSite", args, user);
      const site = await prisma.site.create({
        data: {
          tenant_id: args.tenant_id,
          name: args.name,
          latitude: args.latitude,
          longitude: args.longitude,
          status: args.status ?? "PENDING",
        },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createSite",
        metadata: { site_id: site.site_id, name: site.name },
      });
      return site;
    },

    updateSiteStatus: async (_p, args, { user }) => {
      authorize("updateSiteStatus", args, user);
      const found = await prisma.site.findFirst({
        where: { site_id: args.site_id, tenant_id: args.tenant_id },
      });
      if (!found) throw notFound("Site");
      const site = await prisma.site.update({
        where: { site_id: args.site_id },
        data: { status: args.status },
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "updateSiteStatus",
        metadata: { site_id: args.site_id, status: args.status },
      });
      return site;
    },

    // ---- Phase 4: External integrations (stub-by-default, audit-logged) ----
    syncTallyLedger: async (_p, args, { user }) => {
      authorize("syncTallyLedger", args, user);
      const r = await syncTallyLedger({ tenant_id: args.tenant_id });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "syncTallyLedger",
        metadata: { reference: r.reference, driver: r.driver },
      });
      return r;
    },

    fileGSTReturn: async (_p, args, { user }) => {
      authorize("fileGSTReturn", args, user);
      const r = await fileGstReturnExternal({
        tenant_id: args.tenant_id,
        finance_id: args.finance_id,
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "fileGSTReturn",
        metadata: { finance_id: args.finance_id, reference: r.reference, driver: r.driver },
      });
      return r;
    },

    syncReraUpdates: async (_p, args, { user }) => {
      authorize("syncReraUpdates", args, user);
      const r = await syncReraUpdates({ tenant_id: args.tenant_id });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "syncReraUpdates",
        metadata: { reference: r.reference, driver: r.driver },
      });
      return r;
    },

    requestAadhaarESign: async (_p, args, { user }) => {
      authorize("requestAadhaarESign", args, user);
      const r = await requestAadhaarEsign({
        tenant_id: args.tenant_id,
        contract_id: args.contract_id,
      });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "requestAadhaarESign",
        metadata: { contract_id: args.contract_id, reference: r.reference, driver: r.driver },
      });
      return r;
    },

    importBimModel: async (_p, args, { user }) => {
      authorize("importBimModel", args, user);
      const r = await importBimModel({ tenant_id: args.tenant_id, url: args.url });
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "importBimModel",
        metadata: { url: args.url, reference: r.reference, driver: r.driver },
      });
      return r;
    },
  },
};
