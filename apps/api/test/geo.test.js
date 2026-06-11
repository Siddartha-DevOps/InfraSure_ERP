// Tests for DPR → Site geo extraction (mobile field app integration).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractGeoFromReport, isSameSite } from "../src/geo.js";

test("extracts location from mobile DPR JSON", () => {
  const geo = extractGeoFromReport(
    JSON.stringify({
      note: "Pier 3 poured",
      location: { lat: 12.9716, lng: 77.5946 },
      site_name: "Site A — Pier Casting",
    })
  );
  assert.deepEqual(geo, {
    lat: 12.9716,
    lng: 77.5946,
    name: "Site A — Pier Casting",
  });
});

test("falls back to a coordinate-derived name", () => {
  const geo = extractGeoFromReport(
    JSON.stringify({ location: { lat: 17.385, lng: 78.4867 } })
  );
  assert.equal(geo.name, "Field site 17.385, 78.487");
});

test("returns null for plain-text or geo-less reports", () => {
  assert.equal(extractGeoFromReport("Plain text DPR"), null);
  assert.equal(extractGeoFromReport(JSON.stringify({ note: "no geo" })), null);
});

test("rejects out-of-range or malformed coordinates", () => {
  assert.equal(
    extractGeoFromReport(JSON.stringify({ location: { lat: 999, lng: 0 } })),
    null
  );
  assert.equal(
    extractGeoFromReport(JSON.stringify({ location: { lat: "x", lng: 77 } })),
    null
  );
});

test("isSameSite matches within ~100m and not beyond", () => {
  const site = { latitude: 12.9716, longitude: 77.5946 };
  assert.ok(isSameSite({ lat: 12.9712, lng: 77.5949 }, site));
  assert.ok(!isSameSite({ lat: 12.99, lng: 77.5946 }, site));
});
