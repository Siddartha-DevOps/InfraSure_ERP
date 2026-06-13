// External-integration adapters for InfraSure ERP.
// Each integration is a stub by default (no credentials needed) and becomes a
// real HTTP call once its endpoint/key env vars are present. Mirrors the
// storage/billing adapter pattern. The HTTP client (httpJson) adds timeouts,
// exponential-backoff retries on 5xx/429/network errors, and uniform error
// mapping; it's injectable for testing.
import { randomUUID } from "node:crypto";

// integration → { configEnv (presence ⇒ "live"), baseEnv, keyEnv, path, label }.
// configEnv is what flips the driver to live; baseEnv/keyEnv drive the real call.
export const INTEGRATIONS = {
  TALLY: { configEnv: "TALLY_API_URL", baseEnv: "TALLY_API_URL", keyEnv: null, path: "/ledger/sync", label: "Tally/ERP ledger" },
  GST: { configEnv: "GST_PORTAL_API_KEY", baseEnv: "GST_PORTAL_API_URL", keyEnv: "GST_PORTAL_API_KEY", path: "/returns/file", label: "GSTN return" },
  EPFO: { configEnv: "EPFO_API_KEY", baseEnv: "EPFO_API_URL", keyEnv: "EPFO_API_KEY", path: "/ecr/upload", label: "EPFO ECR" },
  RERA: { configEnv: "RERA_API_KEY", baseEnv: "RERA_API_URL", keyEnv: "RERA_API_KEY", path: "/updates", label: "RERA updates" },
  AADHAAR: { configEnv: "AADHAAR_ESIGN_API_KEY", baseEnv: "AADHAAR_ESIGN_API_URL", keyEnv: "AADHAAR_ESIGN_API_KEY", path: "/esign/request", label: "Aadhaar e-Sign" },
  BIM: { configEnv: "BIM_API_URL", baseEnv: "BIM_API_URL", keyEnv: null, path: "/models/import", label: "BIM model" },
};

export function isConfigured(integration) {
  const cfg = INTEGRATIONS[integration];
  return Boolean(cfg && process.env[cfg.configEnv]);
}

export function integrationStatus() {
  return Object.keys(INTEGRATIONS).map((integration) => ({
    integration,
    configured: isConfigured(integration),
    driver: isConfigured(integration) ? "live" : "stub",
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
function joinUrl(base, path) {
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

// Minimal resilient JSON-over-HTTP client. Retries 5xx/429/network/timeout with
// exponential backoff; fails fast on 4xx. fetchImpl is injectable for tests.
export async function httpJson(
  url,
  { method = "POST", headers = {}, body, timeoutMs = 8000, retries = 2, backoffMs = 200 } = {},
  fetchImpl = globalThis.fetch
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method,
        headers: { "content-type": "application/json", accept: "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ac.signal,
      });
      clearTimeout(timer);
      const text = typeof res.text === "function" ? await res.text() : "";
      const data = text ? safeJson(text) : null;
      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        if (retryable && attempt < retries) {
          await sleep(backoffMs * 2 ** attempt);
          continue;
        }
        const err = new Error(`HTTP ${res.status}: ${(data && data.message) || text || res.statusText || "request failed"}`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // Retry network errors and timeouts (AbortError), but not 4xx (has e.status set).
      const networkOrTimeout = e.name === "AbortError" || e.status === undefined;
      if (attempt < retries && networkOrTimeout) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

// Performs the configured live call for an integration.
async function callLive(integration, payload, opts) {
  const cfg = INTEGRATIONS[integration];
  const base = process.env[cfg.baseEnv] || process.env[cfg.configEnv];
  const key = cfg.keyEnv ? process.env[cfg.keyEnv] : null;
  const headers = key ? { authorization: `Bearer ${key}` } : {};
  return callLive.httpJson(joinUrl(base, cfg.path), { headers, body: payload, ...opts });
}
// Indirection so tests can stub the network without env-configuring every portal.
callLive.httpJson = httpJson;

// Uniform OK result. Real drivers fill reference/detail from the live response.
function ok(integration, detail, extra = {}) {
  return {
    integration,
    status: "OK",
    driver: isConfigured(integration) ? "live" : "stub",
    reference: `${integration.toLowerCase()}_${randomUUID().slice(0, 8)}`,
    detail,
    ...extra,
  };
}

// Uniform error result — a live call failed; surfaced to the user, never thrown
// out of the resolver so one flaky portal can't 500 the whole request.
function errorResult(integration, err) {
  return {
    integration,
    status: "ERROR",
    driver: "live",
    reference: `${integration.toLowerCase()}_err_${randomUUID().slice(0, 8)}`,
    detail: `${INTEGRATIONS[integration].label} call failed: ${err.message}`,
  };
}

export async function syncTallyLedger({ tenant_id }) {
  if (!isConfigured("TALLY"))
    return ok("TALLY", `Ledger sync simulated for tenant ${tenant_id}.`);
  try {
    const data = await callLive("TALLY", { tenant_id });
    return ok("TALLY", `Ledger synced (${data?.vouchers ?? 0} vouchers).`, {
      reference: data?.batch_id || undefined,
    });
  } catch (e) {
    return errorResult("TALLY", e);
  }
}

export async function fileGstReturnExternal({ tenant_id, finance_id }) {
  if (!isConfigured("GST"))
    return ok("GST", `GST return filed via portal for finance ${finance_id}.`);
  try {
    const data = await callLive("GST", { tenant_id, finance_id });
    return ok("GST", `GSTN return filed (ack ${data?.ack_no ?? "n/a"}).`, {
      reference: data?.ack_no || undefined,
    });
  } catch (e) {
    return errorResult("GST", e);
  }
}

export async function fileEpfoReturn({ tenant_id, labour_id }) {
  if (!isConfigured("EPFO"))
    return ok("EPFO", `EPFO ECR upload simulated for filing ${labour_id}.`);
  try {
    const data = await callLive("EPFO", { tenant_id, labour_id });
    return ok("EPFO", `EPFO ECR uploaded (TRRN ${data?.trrn ?? "n/a"}).`, {
      reference: data?.trrn || undefined,
    });
  } catch (e) {
    return errorResult("EPFO", e);
  }
}

export async function syncReraUpdates({ tenant_id }) {
  if (!isConfigured("RERA"))
    return ok("RERA", `Fetched latest RERA notifications for tenant ${tenant_id}.`);
  try {
    const data = await callLive("RERA", { tenant_id }, { method: "GET" });
    return ok("RERA", `Fetched ${data?.count ?? 0} RERA notification(s).`);
  } catch (e) {
    return errorResult("RERA", e);
  }
}

export async function requestAadhaarEsign({ tenant_id, contract_id }) {
  if (!isConfigured("AADHAAR")) {
    const ref = `aadhaar_${randomUUID().slice(0, 8)}`;
    return ok("AADHAAR", `e-Sign request created for contract ${contract_id}. Signing URL issued.`, {
      reference: ref,
    });
  }
  try {
    const data = await callLive("AADHAAR", { tenant_id, contract_id });
    return ok(
      "AADHAAR",
      `e-Sign request created for contract ${contract_id}.${data?.signing_url ? " Signing URL issued." : ""}`,
      { reference: data?.transaction_id || undefined }
    );
  } catch (e) {
    return errorResult("AADHAAR", e);
  }
}

export async function importBimModel({ tenant_id, url }) {
  if (!isConfigured("BIM"))
    return ok("BIM", `BIM model registered from ${url || "(no url)"}.`);
  try {
    const data = await callLive("BIM", { tenant_id, url });
    return ok("BIM", `BIM model imported (${data?.elements ?? 0} elements).`, {
      reference: data?.model_id || undefined,
    });
  } catch (e) {
    return errorResult("BIM", e);
  }
}
