// Audit-logging tests: every mutation must persist {tenant_id, user_id, action,
// timestamp, metadata}. We inject a fake collection so this runs without a live Mongo.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeAuditLog, setAuditCollection } from "../src/mongo.js";

function fakeCollection() {
  const inserts = [];
  return {
    inserts,
    insertOne: async (doc) => {
      inserts.push(doc);
      return { acknowledged: true };
    },
  };
}

afterEach(() => setAuditCollection(null));

test("writeAuditLog persists the required audit fields", async () => {
  const col = fakeCollection();
  setAuditCollection(col);

  await writeAuditLog({
    tenant_id: "tenant-a",
    user_id: "user-1",
    action: "approveRABill",
    metadata: { finance_id: "fin-9" },
  });

  assert.equal(col.inserts.length, 1);
  const log = col.inserts[0];
  assert.equal(log.tenant_id, "tenant-a");
  assert.equal(log.user_id, "user-1");
  assert.equal(log.action, "approveRABill");
  assert.deepEqual(log.metadata, { finance_id: "fin-9" });
  assert.ok(log.timestamp instanceof Date, "timestamp must be a Date");
});

test("writeAuditLog defaults metadata to an object", async () => {
  const col = fakeCollection();
  setAuditCollection(col);
  await writeAuditLog({ tenant_id: "t", user_id: "u", action: "login" });
  assert.deepEqual(col.inserts[0].metadata, {});
});

test("audit logging never throws (fails soft) when the store errors", async () => {
  setAuditCollection({
    insertOne: async () => {
      throw new Error("mongo down");
    },
  });
  // Must resolve, not reject — audit failures must not break business operations.
  await assert.doesNotReject(() =>
    writeAuditLog({ tenant_id: "t", user_id: "u", action: "createDPR" })
  );
});
