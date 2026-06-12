// Tenant-isolation + RBAC enforcement tests for InfraSure ERP.
// authorize() is the middleware every resolver delegates to for security, so these
// tests cover the multi-tenant + role guarantees directly and deterministically.
import { test } from "node:test";
import assert from "node:assert/strict";
import { authorize, PERMISSIONS } from "../src/rbac.js";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const userOf = (role, tenant_id = TENANT_A) => ({
  user_id: "u-1",
  tenant_id,
  role,
});

test("rejects unauthenticated requests", () => {
  assert.throws(
    () => authorize("getContracts", { tenant_id: TENANT_A }, null),
    /authentication required/
  );
});

test("tenant isolation: rejects mismatched tenant_id (even for ADMIN)", () => {
  // JWT tenant = A, request tenant = B → must be rejected before anything else.
  assert.throws(
    () => authorize("getContracts", { tenant_id: TENANT_B }, userOf("ADMIN")),
    /tenant mismatch/
  );
  assert.throws(
    () =>
      authorize(
        "createContract",
        { tenant_id: TENANT_B },
        userOf("PROJECT_MANAGER")
      ),
    /tenant mismatch/
  );
});

test("tenant isolation: allows matching tenant_id", () => {
  assert.doesNotThrow(() =>
    authorize("getContracts", { tenant_id: TENANT_A }, userOf("ENGINEER"))
  );
});

test("RBAC: Accountant cannot logSafetyAudit, can fileGST", () => {
  assert.throws(
    () => authorize("logSafetyAudit", { tenant_id: TENANT_A }, userOf("ACCOUNTANT")),
    /cannot perform logSafetyAudit/
  );
  assert.doesNotThrow(() =>
    authorize("fileGST", { tenant_id: TENANT_A }, userOf("ACCOUNTANT"))
  );
});

test("RBAC: Engineer cannot fileGST, can createDPR", () => {
  assert.throws(
    () => authorize("fileGST", { tenant_id: TENANT_A }, userOf("ENGINEER")),
    /cannot perform fileGST/
  );
  assert.doesNotThrow(() =>
    authorize("createDPR", { tenant_id: TENANT_A }, userOf("ENGINEER"))
  );
});

test("RBAC: billing is ADMIN-only", () => {
  for (const role of ["ENGINEER", "ACCOUNTANT", "COMPLIANCE_OFFICER", "PROJECT_MANAGER"]) {
    assert.throws(
      () => authorize("changeSubscriptionPlan", { tenant_id: TENANT_A }, userOf(role)),
      /cannot perform changeSubscriptionPlan/,
      `${role} must not change subscription plan`
    );
  }
  assert.doesNotThrow(() =>
    authorize("changeSubscriptionPlan", { tenant_id: TENANT_A }, userOf("ADMIN"))
  );
});

test("RBAC: ADMIN wildcard can perform any operation", () => {
  for (const op of ["logSafetyAudit", "fileGST", "createVendor", "syncTallyLedger", "getAIInsights"]) {
    assert.doesNotThrow(() =>
      authorize(op, { tenant_id: TENANT_A }, userOf("ADMIN"))
    );
  }
});

test("RBAC matrix: every listed permission is allowed for its role", () => {
  for (const [role, ops] of Object.entries(PERMISSIONS)) {
    if (ops.includes("*")) continue; // wildcard roles handled separately
    for (const op of ops) {
      assert.doesNotThrow(
        () => authorize(op, { tenant_id: TENANT_A }, userOf(role)),
        `${role} should be allowed ${op}`
      );
    }
  }
});

test("SUPER_ADMIN is cross-tenant (no tenant-mismatch rejection)", () => {
  // Platform owner whose home tenant is A may still read tenant B.
  assert.doesNotThrow(() =>
    authorize("getContracts", { tenant_id: TENANT_B }, userOf("SUPER_ADMIN"))
  );
  assert.doesNotThrow(() =>
    authorize("getDashboardSummary", { tenant_id: TENANT_B }, userOf("SUPER_ADMIN"))
  );
});

test("platform operations are SUPER_ADMIN-only (even COMPANY_ADMIN is denied)", () => {
  for (const role of ["ADMIN", "COMPANY_ADMIN", "PROJECT_MANAGER", "ENGINEER"]) {
    assert.throws(
      () => authorize("getPlatformStats", {}, userOf(role)),
      /cannot perform getPlatformStats/,
      `${role} must not access platform stats`
    );
  }
  assert.doesNotThrow(() => authorize("getPlatformStats", {}, userOf("SUPER_ADMIN")));
  assert.doesNotThrow(() => authorize("getTenants", {}, userOf("SUPER_ADMIN")));
});

test("COMPANY_ADMIN is a tenant-scoped wildcard but rejects cross-tenant", () => {
  assert.doesNotThrow(() =>
    authorize("changeSubscriptionPlan", { tenant_id: TENANT_A }, userOf("COMPANY_ADMIN"))
  );
  assert.throws(
    () => authorize("getContracts", { tenant_id: TENANT_B }, userOf("COMPANY_ADMIN")),
    /tenant mismatch/
  );
});

test("CONTRACTOR / VENDOR are restricted to their allowed operations", () => {
  assert.doesNotThrow(() =>
    authorize("createDPR", { tenant_id: TENANT_A }, userOf("CONTRACTOR"))
  );
  assert.throws(
    () => authorize("approveRABill", { tenant_id: TENANT_A }, userOf("CONTRACTOR")),
    /cannot perform approveRABill/
  );
  assert.doesNotThrow(() =>
    authorize("getExpiringCertifications", { tenant_id: TENANT_A }, userOf("VENDOR"))
  );
  assert.throws(
    () => authorize("createContract", { tenant_id: TENANT_A }, userOf("VENDOR")),
    /cannot perform createContract/
  );
});
