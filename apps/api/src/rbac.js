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
    "getContracts",
    "getExpiringContracts",
    "getEnvironmentalLogs",
    "getComplianceKPIs",
    "getDPRs",
    "getWorkflowSteps",
    "getSites",
    "getBillingTiers",
    "getAIInsights",
    "logSafetyAudit",
    "logEnvironmentalLog",
    "createDPR",
  ],
  ACCOUNTANT: [
    "getDashboardSummary",
    "getAuditFeed",
    "getFinanceRecords",
    "getLabourFilings",
    "getComplianceKPIs",
    "getAuditReadiness",
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
  ],
  COMPLIANCE_OFFICER: [
    "getDashboardSummary",
    "getAuditFeed",
    "getContractors",
    "getContracts",
    "getExpiringContracts",
    "getSafetyAudits",
    "getEnvironmentalLogs",
    "getLabourFilings",
    "getReraFilings",
    "getComplianceKPIs",
    "getWorkflowSteps",
    "getSites",
    "getVendors",
    "getExpiringCertifications",
    "getDisputes",
    "getAuditReadiness",
    "getBillingTiers",
    "getAIInsights",
    "getIntegrationStatus",
    "createSite",
    "updateSiteStatus",
    "updateContractStatus",
    "uploadContractDocument",
    "logEnvironmentalReport",
    "logEnvironmentalLog",
    "createLabourFiling",
    "updateLabourFilingStatus",
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
    "getAuditFeed",
    "getContractors",
    "createContractor",
    "updateContractorStatus",
    "getContracts",
    "getExpiringContracts",
    "getFinanceRecords",
    "getSafetyAudits",
    "getEnvironmentalLogs",
    "getLabourFilings",
    "getReraFilings",
    "getComplianceKPIs",
    "getDPRs",
    "getWorkflowSteps",
    "getSites",
    "getVendors",
    "getExpiringCertifications",
    "getDisputes",
    "getAuditReadiness",
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
    "getDPRs",
    "getSafetyAudits",
    "getComplianceKPIs",
    "getContractors",
    "createDPR",
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
