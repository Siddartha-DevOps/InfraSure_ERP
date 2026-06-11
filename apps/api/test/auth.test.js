// JWT injection tests: tokens must carry {user_id, tenant_id, role} and round-trip,
// since the whole tenant/RBAC model depends on those claims being trustworthy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken, getUserFromAuthHeader } from "../src/auth.js";

test("signed token round-trips the tenant/role claims", () => {
  const token = signToken({ user_id: "u-1", tenant_id: "tenant-a", role: "ENGINEER" });
  const decoded = getUserFromAuthHeader(`Bearer ${token}`);
  assert.deepEqual(decoded, {
    user_id: "u-1",
    tenant_id: "tenant-a",
    role: "ENGINEER",
  });
});

test("accepts a raw token without the Bearer prefix", () => {
  const token = signToken({ user_id: "u-2", tenant_id: "tenant-b", role: "ADMIN" });
  assert.equal(getUserFromAuthHeader(token).tenant_id, "tenant-b");
});

test("rejects missing or tampered tokens", () => {
  assert.equal(getUserFromAuthHeader(null), null);
  assert.equal(getUserFromAuthHeader("Bearer not-a-real-token"), null);
});
