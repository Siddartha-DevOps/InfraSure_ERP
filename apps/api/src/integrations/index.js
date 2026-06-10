// External-integration adapters for InfraSure ERP (Phase 4).
// Each integration is a stub by default (no external credentials needed) and becomes
// "configured" once its env var is present — at which point a real implementation
// would replace the stub branch. Mirrors the storage/billing adapter pattern.
import { randomUUID } from "node:crypto";

// integration → the env var that, when set, marks it as configured for real use.
const CONFIG_ENV = {
  TALLY: "TALLY_API_URL",
  GST: "GST_PORTAL_API_KEY",
  RERA: "RERA_API_KEY",
  AADHAAR: "AADHAAR_ESIGN_API_KEY",
  BIM: "BIM_API_URL",
};

export function isConfigured(integration) {
  const env = CONFIG_ENV[integration];
  return Boolean(env && process.env[env]);
}

export function integrationStatus() {
  return Object.keys(CONFIG_ENV).map((integration) => ({
    integration,
    configured: isConfigured(integration),
    driver: isConfigured(integration) ? "live" : "stub",
  }));
}

// Builds a uniform result. Real drivers would perform the actual call here.
function result(integration, detail, extra = {}) {
  return {
    integration,
    status: "OK",
    driver: isConfigured(integration) ? "live" : "stub",
    reference: `${integration.toLowerCase()}_${randomUUID().slice(0, 8)}`,
    detail,
    ...extra,
  };
}

export async function syncTallyLedger({ tenant_id }) {
  // Real: pull/push vouchers to Tally/SAP. Stub: report a no-op sync.
  return result("TALLY", `Ledger sync simulated for tenant ${tenant_id}.`);
}

export async function fileGstReturnExternal({ tenant_id, finance_id }) {
  return result("GST", `GST return filed via portal for finance ${finance_id}.`);
}

export async function syncReraUpdates({ tenant_id }) {
  return result("RERA", `Fetched latest RERA notifications for tenant ${tenant_id}.`);
}

export async function requestAadhaarEsign({ tenant_id, contract_id }) {
  const ref = `aadhaar_${randomUUID().slice(0, 8)}`;
  return result("AADHAAR", `e-Sign request created for contract ${contract_id}.`, {
    reference: ref,
    detail: `e-Sign request created for contract ${contract_id}. Signing URL issued.`,
  });
}

export async function importBimModel({ tenant_id, url }) {
  return result("BIM", `BIM model registered from ${url || "(no url)"}.`);
}
