// End-to-end resolver tests against REAL Postgres + MongoDB.
//
// Gated: set TEST_DATABASE_URL (and optionally MONGO_URL) to run. Without them the
// suite skips cleanly, so the default `npm test` stays runnable everywhere. In a
// provisioned environment this validates positive paths, cross-tenant rejection at
// the resolver layer, and audit-log persistence into Mongo.
//
//   TEST_DATABASE_URL=postgresql://… MONGO_URL=mongodb://… npm run test:integration
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const RUN = Boolean(process.env.TEST_DATABASE_URL);
// Mongo is optional: with only Postgres the suite still validates the positive
// path, tenant isolation and RBAC; the audit-persistence assertion needs Mongo.
const RUN_MONGO = RUN && Boolean(process.env.MONGO_URL);
if (RUN) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Import lazily so the Prisma client / Mongo aren't required when skipping.
let prisma, resolvers, connectMongo, closeMongo;
let tenantA, tenantB, engineerA;

before(async (t) => {
  if (!RUN) return t.skip("set TEST_DATABASE_URL to run integration tests");
  ({ default: prisma } = await import("@infrasure/db"));
  ({ resolvers } = await import("../src/resolvers.js"));
  ({ connectMongo, closeMongo } = await import("../src/mongo.js"));
  if (RUN_MONGO) await connectMongo();

  tenantA = await prisma.tenant.create({ data: { company_name: "IT-A" } });
  tenantB = await prisma.tenant.create({ data: { company_name: "IT-B" } });
  engineerA = await prisma.user.create({
    data: {
      tenant_id: tenantA.tenant_id,
      email: `eng-${Date.now()}@it.test`,
      password_hash: "x",
      role: "ENGINEER",
    },
  });
});

after(async () => {
  if (!RUN) return;
  await prisma.tenant.delete({ where: { tenant_id: tenantA.tenant_id } });
  await prisma.tenant.delete({ where: { tenant_id: tenantB.tenant_id } });
  await prisma.$disconnect();
  if (RUN_MONGO) await closeMongo();
});

test("positive path: Engineer creates a DPR and reads it back", { skip: !RUN }, async () => {
  const ctx = { user: { ...engineerA, user_id: engineerA.user_id } };
  const dpr = await resolvers.Mutation.createDPR(
    null,
    { tenant_id: tenantA.tenant_id, report_data: "Pier 3 poured" },
    ctx
  );
  assert.ok(dpr.dpr_id);

  const list = await prisma.dpr.findMany({ where: { tenant_id: tenantA.tenant_id } });
  assert.ok(list.some((d) => d.dpr_id === dpr.dpr_id));
});

test("audit log written for the mutation", { skip: !RUN_MONGO }, async () => {
  const col = await connectMongo();
  const logs = await col
    .find({ tenant_id: tenantA.tenant_id, action: "createDPR" })
    .toArray();
  assert.ok(logs.length >= 1);
  assert.equal(logs[0].user_id, engineerA.user_id);
  assert.ok(logs[0].timestamp);
});

test("tenant isolation: Engineer of A cannot write into tenant B", { skip: !RUN }, async () => {
  const ctx = { user: { ...engineerA, user_id: engineerA.user_id } };
  await assert.rejects(
    () =>
      resolvers.Mutation.createDPR(
        null,
        { tenant_id: tenantB.tenant_id, report_data: "leak" },
        ctx
      ),
    /tenant mismatch/
  );
});

test("RBAC: Engineer cannot fileGST", { skip: !RUN }, async () => {
  const ctx = { user: { ...engineerA, user_id: engineerA.user_id } };
  await assert.rejects(
    () =>
      resolvers.Mutation.fileGST(
        null,
        { tenant_id: tenantA.tenant_id, finance_id: "x" },
        ctx
      ),
    /cannot perform fileGST/
  );
});
