// Extracts a geo location from a DPR's report payload (Phase 4 mobile app sends
// JSON like {"note": "...", "location": {"lat": 12.97, "lng": 77.59}, "site_name": "..."}).
// Returns { lat, lng, name } or null. Pure + dependency-free so it's unit-testable.
export function extractGeoFromReport(report_data) {
  let parsed;
  try {
    parsed = JSON.parse(report_data);
  } catch {
    return null; // plain-text DPRs carry no coordinates
  }
  const loc = parsed?.location;
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const name =
    (typeof parsed.site_name === "string" && parsed.site_name.trim()) ||
    `Field site ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  return { lat, lng, name };
}

// Two coordinates are "the same site" when within ~100m (0.001°).
export function isSameSite(a, b) {
  return Math.abs(a.lat - b.latitude) < 0.001 && Math.abs(a.lng - b.longitude) < 0.001;
}
