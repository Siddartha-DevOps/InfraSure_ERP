// GraphQL resolvers for InfraSure ERP (Phase 1).
// Every resolver enforces tenant isolation + RBAC via authorize(), and every
// mutation writes an audit log to MongoDB.
import { GraphQLError } from "graphql";
import prisma from "@infrasure/db";
import { authorize } from "./rbac.js";
import { writeAuditLog } from "./mongo.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
} from "./auth.js";

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
      await writeAuditLog({
        tenant_id: args.tenant_id,
        user_id: user.user_id,
        action: "createDPR",
        metadata: { dpr_id: dpr.dpr_id },
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
  },
};
