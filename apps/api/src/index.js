// InfraSure ERP API — Express + Apollo GraphQL server.
import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { getUserFromAuthHeader } from "./auth.js";
import { connectMongo } from "./mongo.js";

const PORT = process.env.PORT || 4000;

async function start() {
  await connectMongo();

  const app = express();
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use(
    "/graphql",
    cors(),
    bodyParser.json(),
    expressMiddleware(server, {
      // Decode JWT once per request → { user_id, tenant_id, role } in context.
      context: async ({ req }) => ({
        user: getUserFromAuthHeader(req.headers.authorization),
      }),
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 InfraSure API ready at http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
