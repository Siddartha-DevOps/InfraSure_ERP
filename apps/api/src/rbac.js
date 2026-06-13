// Role-based access control for InfraSure ERP.
// Maps each role to the GraphQL operations it may execute. ADMIN gets a wildcard.
// Mirrors the product-owner role-based workflow design.

import { GraphQLError } from "graphql";

export const PUBLIC_OPERATIONS = new Set(["signupTenant", "login", "me"]);

// Cross-tenant, platform-wide operations — exclusive to SUPER_ADMIN. Even a
// tenant-wildcard COMPANY_ADMIN cannot reach these.
export const PLATFORM_OPERATIONS = new Set([
  "getPlatformStats",
  "getTenants",
  "getPlatformAuditFeed",
]);

export const PERMISSIONS = {
  ENGINEER: [
    "getDashboardSummary",
    "getAuditFeed",
    "getSafetyAudits",
    "getIncidents",
    "getClearances",
    "getExpiringClearances",
    "getContracts",
    "getExpiringContracts",
    "getEnvironmentalLogs",
    "getComplianceKPIs",
    "getDPRs",
    "getWorkflowSteps",
    "getSites",
    "getProjects",
    "getBillingTiers",
    "getAIInsights",
    "logSafetyAudit",
    "logIncident",
    "logEnvironmentalLog",
    "createDPR",
  ],
  ACCOUNTANT: [
    "getDashboardSummary",
    "getComplianceTrend",
    "getAuditFeed",
    "getFinanceRecords",
    "getLabourFilings",
    "getComplianceKPIs",
    "getAuditReadiness",
    "getAuditReadinessTrend",
    "getRetrievalMetrics",
    "recordRetrieval",
    "getReminders",
    "runDailyReminders",
    "dismissReminder",
    "getSites",
    "getBillingTiers",
    "getAIInsights",
    "getIntegrationStatus",
    "createFinanceRecord",
    "fileGST",
    "fileTDS",
    "approveRABill",
    "recordPayment",
    "createLabourFiling",
    "updateLabourFilingStatus",
    "syncTallyLedger",
    "fileGSTReturn",
    "fileEPFOReturn",
  ],
  COMPLIANCE_OFFICER: [
    "getDashboardSummary",
    "getComplianceTrend",
    "getAuditFeed",
    "getContractors",
    "getContracts",
    "getExpiringContracts",
    "getSafetyAudits",
    "getIncidents",
    "getClearances",
    "getExpiringClearances",
    "getEnvironmentalLogs",
    "getLabourFilings",
    "getReraFilings",
    "getComplianceKPIs",
    "getWorkflowSteps",
    "getSites",
    "getProjects",
    "getVendors",
    "getExpiringCertifications",
    "getDisputes",
    "getAuditReadiness",
    "getAuditReadinessTrend",
    "getRetrievalMetrics",
    "recordRetrieval",
    "getReminders",
    "runDailyReminders",
    "dismissReminder",
    "getBillingTiers",
    "getAIInsights",
    "getIntegrationStatus",
    "createSite",
    "updateSiteStatus",
    "logIncident",
    "updateIncidentStatus",
    "createClearance",
    "renewClearance",
    "captureAuditReadinessSnapshot",
    "updateContractStatus",
    "uploadContractDocument",
    "logEnvironmentalReport",
    "logEnvironmentalLog",
    "createLabourFiling",
    "updateLabourFilingStatus",
    "fileEPFOReturn",
    "createReraFiling",
    "updateReraFilingStatus",
    "createVendor",
    "updateVendorStatus",
    "createDispute",
    "updateDisputeStatus",
    "escalateDispute",
    "syncReraUpdates",
    "requestAadhaarESign",
    "importBimModel",
  ],
  PROJECT_MANAGER: [
    "getTenant",
    "getUsers",
    "getDashboardSummary",
    "getComplianceTrend",
    "getAuditFeed",
    "getContractors",
    "createContractor",
    "updateContractorStatus",
    "getContracts",
    "getExpiringContracts",
    "getFinanceRecords",
    "getSafetyAudits",
    "getIncidents",
    "logIncident",
    "updateIncidentStatus",
    "getClearances",
    "getExpiringClearances",
    "createClearance",
    "renewClearance",
    "getEnvironmentalLogs",
    "getLabourFilings",
    "getReraFilings",
    "getComplianceKPIs",
    "getDPRs",
    "getWorkflowSteps",
    "getSites",
    "getProjects",
    "createProject",
    "getVendors",
    "getExpiringCertifications",
    "getDisputes",
    "getAuditReadiness",
    "getAuditReadinessTrend",
    "getRetrievalMetrics",
    "recordRetrieval",
    "getReminders",
    "runDailyReminders",
    "dismissReminder",
    "getBillingTiers",
    "getAIInsights",
    "getIntegrationStatus",
    "createSite",
    "updateSiteStatus",
    "createContract",
    "uploadContractDocument",
    "createReraFiling",
    "updateReraFilingStatus",
    "createVendor",
    "updateVendorStatus",
    "createDispute",
    "updateDisputeStatus",
    "escalateDispute",
    "approveWorkflowStep",
    "assignUserRole",
    "captureAuditReadinessSnapshot",
    "syncReraUpdates",
    "requestAadhaarESign",
    "importBimModel",
  ],
  ADMIN: ["*"],
  // Tenant-wide wildcard (same blast radius as ADMIN, scoped to one tenant).
  COMPANY_ADMIN: ["*"],
  // Platform owner — cross-tenant. authorize() handles it specially; "*" documents intent.
  SUPER_ADMIN: ["*"],
  // External subcontractor: own assignments + field reporting.
  CONTRACTOR: [
    "getMyContractorProfile",
    "getDashboardSummary",
    "getContracts",
    "getSites",
    "getProjects",
    "getDPRs",
    "getSafetyAudits",
    "getIncidents",
    "getClearances",
    "getComplianceKPIs",
    "getContractors",
    "createDPR",
    "logIncident",
  ],
  // External material/service vendor: own record + compliance docs.
  VENDOR: [
    "getMyVendorProfile",
    "getDashboardSummary",
    "getVendors",
    "getExpiringCertifications",
    "getContracts",
    "getBillingTiers",
  ],
};

function unauthorized(message) {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

// Enforces: authenticated, tenant isolation, and role permission for the operation.
// SUPER_ADMIN is cross-tenant (platform oversight); platform ops are SUPER_ADMIN-only.
export function authorize(operation, args, user) {
  if (!user) {
    throw unauthorized("Unauthorized: authentication required");
  }

  // Platform-wide operations are exclusive to SUPER_ADMIN and skip the tenant check.
  if (PLATFORM_OPERATIONS.has(operation)) {
    if (user.role !== "SUPER_ADMIN") {
      throw unauthorized(
        `Unauthorized: role ${user.role} cannot perform ${operation}`
      );
    }
    return;
  }

  // SUPER_ADMIN may read across tenants for platform oversight.
  if (user.role === "SUPER_ADMIN") return;

  // Tenant isolation — the requested tenant_id must match the token.
  if (args?.tenant_id && args.tenant_id !== user.tenant_id) {
    throw unauthorized("Unauthorized: tenant mismatch");
  }

  const allowed = PERMISSIONS[user.role] || [];
  if (!allowed.includes("*") && !allowed.includes(operation)) {
    throw unauthorized(
      `Unauthorized: role ${user.role} cannot perform ${operation}`
    );
  }
}
