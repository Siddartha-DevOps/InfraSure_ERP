// Tests for the external-integration HTTP client and adapter behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  httpJson,
  isConfigured,
  integrationStatus,
  syncTallyLedger,
} from "../src/integrations/index.js";

// Builds a fake fetch that returns scripted responses (one per call).
function fakeFetch(scripts) {
  let i = 0;
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const s = scripts[Math.min(i, scripts.length - 1)];
    i++;
    if (s.throw) throw s.throw;
    return {
      ok: s.status >= 200 && s.status < 300,
      status: s.status,
      statusText: s.statusText || "",
      text: async () => s.body ?? "",
    };
  };
  fn.calls = calls;
  return fn;
}

test("httpJson parses a 200 JSON body", async () => {
  const f = fakeFetch([{ status: 200, body: JSON.stringify({ ack_no: "A1" }) }]);
  const data = await httpJson("http://x/y", { backoffMs: 1 }, f);
  assert.deepEqual(data, { ack_no: "A1" });
  assert.equal(f.calls.length, 1);
});

test("httpJson retries a 500 then succeeds", async () => {
  const f = fakeFetch([
    { status: 500, body: "boom" },
    { status: 200, body: JSON.stringify({ ok: true }) },
  ]);
  const data = await httpJson("http://x", { backoffMs: 1, retries: 2 }, f);
  assert.deepEqual(data, { ok: true });
  assert.equal(f.calls.length, 2);
});

test("httpJson gives up after retries on persistent 503", async () => {
  const f = fakeFetch([{ status: 503, body: "down" }]);
  await assert.rejects(
    () => httpJson("http://x", { backoffMs: 1, retries: 2 }, f),
    /HTTP 503/
  );
  assert.equal(f.calls.length, 3); // initial + 2 retries
});

test("httpJson fails fast on a 4xx (no retry)", async () => {
  const f = fakeFetch([{ status: 400, body: JSON.stringify({ message: "bad input" }) }]);
  await assert.rejects(
    () => httpJson("http://x", { backoffMs: 1, retries: 3 }, f),
    /HTTP 400: bad input/
  );
  assert.equal(f.calls.length, 1);
});

test("httpJson retries network errors then throws", async () => {
  const netErr = new Error("ECONNRESET");
  const f = fakeFetch([{ throw: netErr }]);
  await assert.rejects(() => httpJson("http://x", { backoffMs: 1, retries: 1 }, f));
  assert.equal(f.calls.length, 2);
});

test("integrations default to the stub driver when unconfigured", () => {
  assert.equal(isConfigured("GST"), false);
  const status = integrationStatus();
  const gst = status.find((s) => s.integration === "GST");
  assert.equal(gst.driver, "stub");
  // EPFO is now a first-class integration.
  assert.ok(status.some((s) => s.integration === "EPFO"));
});

test("an unconfigured integration returns an OK stub result", async () => {
  const r = await syncTallyLedger({ tenant_id: "t1" });
  assert.equal(r.status, "OK");
  assert.equal(r.driver, "stub");
  assert.match(r.detail, /simulated/);
});
