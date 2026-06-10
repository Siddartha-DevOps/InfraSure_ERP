// Client for the Python AI engine (Phase 4).
// The GraphQL API calls this; if the AI service is unreachable, callers degrade
// gracefully (available: false) rather than failing the request.
const AI_URL = process.env.AI_ENGINE_URL || "http://localhost:8000";
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 4000);

async function post(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI engine ${path} → ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Runs anomaly detection + compliance scoring; returns a normalized insights object.
export async function getInsights({ records, metrics }) {
  try {
    const [anomalyRes, scoreRes] = await Promise.all([
      post("/anomalies", { records }),
      post("/compliance-score", { metrics }),
    ]);
    return {
      available: true,
      predictive_score: scoreRes.score,
      risk_level: scoreRes.risk_level,
      weak_factors: (scoreRes.weak_factors || []).map((f) => f.metric),
      anomalies: anomalyRes.anomalies || [],
    };
  } catch (err) {
    console.error("[ai] engine unavailable:", err.message);
    return {
      available: false,
      predictive_score: null,
      risk_level: "UNKNOWN",
      weak_factors: [],
      anomalies: [],
    };
  }
}

export const aiConfig = { AI_URL };
