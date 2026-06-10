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
  Finance: { due_date: (f) => iso(f.due_date) },
  Safety: { audit_date: (s) => iso(s.audit_date) },
  Dpr: { created_at: (d) => iso(d.created_at) },
  EnvironmentalReport: { created_at: (e) => iso(e.created_at) },

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

    // ---- Safety / field ----
    logSafetyAudit: async (_p, args, { user }) => {
      authorize("logSafetyAudit", args, user);
      const audit = await prisma.safety.create({
        data: {
          tenant_id: args.tenant_id,
          checklist_status: args.checklist_status,
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
