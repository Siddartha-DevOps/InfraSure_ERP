// Billing adapter for InfraSure ERP (Phase 3).
// Default driver is a deterministic "stub" so the app runs with no Stripe account;
// set STRIPE_SECRET_KEY (and BILLING_DRIVER=stripe) to use real Stripe Checkout.
// Resolvers only call listTiers() / createCheckoutSession(), so the driver is swappable.
import { randomUUID } from "node:crypto";

// Subscription tiers. Prices are illustrative monthly INR amounts.
export const TIERS = {
  BASIC: {
    code: "BASIC",
    name: "Basic",
    price_inr: 0,
    features: ["Contracts", "Compliance KPIs", "1 project"],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    price_inr: 4999,
    features: ["Everything in Basic", "Labour & RERA", "Vendor & dispute tracking"],
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    name: "Enterprise",
    price_inr: 19999,
    features: ["Everything in Pro", "Audit readiness", "Priority support", "SSO (Phase 4)"],
  },
};

const DRIVER =
  process.env.BILLING_DRIVER ||
  (process.env.STRIPE_SECRET_KEY ? "stripe" : "stub");

export function listTiers() {
  return Object.values(TIERS);
}

export function isValidPlan(plan) {
  return Boolean(TIERS[plan]);
}

// Creates a checkout session for the requested plan and returns a redirect URL.
export async function createCheckoutSession({ plan_type, customer_email }) {
  const tier = TIERS[plan_type];
  if (!tier) throw new Error(`Unknown plan: ${plan_type}`);

  if (DRIVER === "stripe") {
    // Lazy-load so the stub path never requires the optional `stripe` dependency.
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email,
      line_items: [{ price: process.env[`STRIPE_PRICE_${plan_type}`], quantity: 1 }],
      success_url:
        process.env.BILLING_SUCCESS_URL || "https://app.example.test/billing?status=success",
      cancel_url:
        process.env.BILLING_CANCEL_URL || "https://app.example.test/billing?status=cancel",
    });
    return { session_id: session.id, url: session.url, plan_type, driver: "stripe" };
  }

  // Stub driver — deterministic fake session for local/dev demos.
  const session_id = `cs_test_${randomUUID().replace(/-/g, "")}`;
  return {
    session_id,
    url: `https://billing.example.test/checkout/${session_id}?plan=${plan_type}`,
    plan_type,
    driver: "stub",
  };
}

export const billingConfig = { DRIVER };
