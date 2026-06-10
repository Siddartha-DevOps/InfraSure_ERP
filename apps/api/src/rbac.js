// Role-based access control for InfraSure ERP.
// Maps each role to the GraphQL operations it may execute. ADMIN gets a wildcard.
// Mirrors the product-owner role-based workflow design.

import { GraphQLError } from "graphql";

export const PUBLIC_OPERATIONS = new Set(["signupTenant", "login", "me"]);

export const PERMISSIONS = {
  ENGINEER: [
    "getSafetyAudits",
    "getContracts",
    "getExpiringContracts",
    "getEnvironmentalLogs",
    "getComplianceKPIs",
    "getBillingTiers",
    "logSafetyAudit",
    "logEnvironmentalLog",
    "createDPR",
  ],
  ACCOUNTANT: [
    "getFinanceRecords",
    "getLabourFilings",
    "getComplianceKPIs",
    "getAuditReadiness",
    "getBillingTiers",
    "createFinanceRecord",
    "fileGST",
    "fileTDS",
    "approveRABill",
    "recordPayment",
    "createLabourFiling",
    "updateLabourFilingStatus",
  ],
  COMPLIANCE_OFFICER: [
    "getContracts",
    "getExpiringContracts",
    "getSafetyAudits",
    "getEnvironmentalLogs",
    "getLabourFilings",
    "getReraFilings",
    "getComplianceKPIs",
    "getVendors",
    "getExpiringCertifications",
    "getDisputes",
    "getAuditReadiness",
    "getBillingTiers",
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
  ],
  PROJECT_MANAGER: [
    "getTenant",
    "getUsers",
    "getContracts",
    "getExpiringContracts",
    "getFinanceRecords",
    "getSafetyAudits",
    "getEnvironmentalLogs",
    "getLabourFilings",
    "getReraFilings",
    "getComplianceKPIs",
    "getVendors",
    "getExpiringCertifications",
    "getDisputes",
    "getAuditReadiness",
    "getBillingTiers",
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
  ],
  ADMIN: ["*"],
};

function unauthorized(message) {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

// Enforces: authenticated, tenant_id in args matches the token, role permits the op.
export function authorize(operation, args, user) {
  if (!user) {
    throw unauthorized("Unauthorized: authentication required");
  }

  // Tenant isolation — the requested tenant_id must match the token.
  if (args?.tenant_id && args.tenant_id !== user.tenant_id) {
    throw unauthorized("Unauthorized: tenant mismatch");
  }

  const allowed = PERMISSIONS[user.role] || [];
  if (user.role !== "ADMIN" && !allowed.includes(operation)) {
    throw unauthorized(
      `Unauthorized: role ${user.role} cannot perform ${operation}`
    );
  }
}
