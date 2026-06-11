// MongoDB connection + immutable audit-log writer for InfraSure ERP.
import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB || "infrasure_audit";

let client;
let auditCollection;

export async function connectMongo() {
  if (auditCollection) return auditCollection;
  // Fail fast when Mongo is unreachable so callers (and startup) don't hang on the
  // driver's 30s default server-selection timeout.
  client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  auditCollection = client.db(MONGO_DB).collection("audit_logs");
  return auditCollection;
}

// Every mutation calls this: who (user_id) did what (action) for which tenant, when.
export async function writeAuditLog({ tenant_id, user_id, action, metadata }) {
  try {
    const col = await connectMongo();
    await col.insertOne({
      tenant_id,
      user_id,
      action,
      metadata: metadata || {},
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit logging must never break the business operation; surface for ops.
    console.error("[audit] failed to write log:", err.message);
  }
}

export async function closeMongo() {
  if (client) await client.close();
}

// Test/DI seam: inject a collection (e.g. a fake/in-memory one) so audit logging
// can be observed without a live MongoDB. Pass null to reset.
export function setAuditCollection(col) {
  auditCollection = col;
}
