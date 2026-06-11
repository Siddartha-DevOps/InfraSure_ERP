// Regression guard: every non-public GraphQL operation must call authorize() in its
// resolver. This prevents a new module (Finance, RERA, Vendors, …) from shipping a
// resolver that skips the tenant-isolation / RBAC check and leaks across tenants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSchema } from "graphql";
import { typeDefs } from "../src/schema.js";
import { PUBLIC_OPERATIONS } from "../src/rbac.js";

const resolverSrc = readFileSync(
  fileURLToPath(new URL("../src/resolvers.js", import.meta.url)),
  "utf8"
);

const schema = buildSchema(typeDefs);
const operations = [
  ...Object.keys(schema.getQueryType().getFields()),
  ...Object.keys(schema.getMutationType().getFields()),
];

test("schema exposes a non-trivial set of operations", () => {
  assert.ok(operations.length >= 25, `only ${operations.length} operations found`);
});

test("every non-public operation calls authorize() in its resolver", () => {
  const missing = operations.filter(
    (op) =>
      !PUBLIC_OPERATIONS.has(op) && !resolverSrc.includes(`authorize("${op}"`)
  );
  assert.deepEqual(
    missing,
    [],
    `these operations are missing an authorize() call: ${missing.join(", ")}`
  );
});

test("public operations are intentionally unguarded", () => {
  // signupTenant/login issue tokens; me reads the caller's own identity.
  assert.deepEqual([...PUBLIC_OPERATIONS].sort(), ["login", "me", "signupTenant"]);
});
