// InfraSure ERP API — Express + Apollo GraphQL server.
import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import { ApolloServer } from "@apollo/server";
// Apollo Server v5 moved the Express 4 middleware out of @apollo/server into
// its own integration package.
import { expressMiddleware } from "@as-integrations/express4";
import prisma from "@infrasure/db";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { getUserFromAuthHeader } from "./auth.js";
import { authorize } from "./rbac.js";
import { connectMongo, writeAuditLog } from "./mongo.js";
import { storeFile, storageConfig } from "./storage.js";
import { runDailyJobs } from "./scheduler.js";

const PORT = process.env.PORT || 4000;

// In-memory upload (≤10MB); the storage adapter decides where bytes land.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function start() {
  // Warm the Mongo connection in the background; don't block boot on it. Audit
  // logging lives in MongoDB but a Mongo outage must not stop the API from
  // serving — writeAuditLog reconnects per write and fails soft.
  connectMongo().catch((err) =>
    console.error(
      "[startup] MongoDB not ready — audit logging will retry:",
      err.message
    )
  );

  const app = express();
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Serve locally-stored documents in dev (no-op once STORAGE_DRIVER=s3).
  if (storageConfig.DRIVER === "local") {
    app.use(storageConfig.PUBLIC_PATH, express.static(storageConfig.UPLOAD_DIR));
  }

  // REST upload — file uploads stay on REST per the Phase 1 decision.
  // Attaches a document to a contract: tenant-isolated, RBAC-checked, audit-logged.
  app.post(
    "/api/contracts/:contractId/document",
    cors(),
    upload.single("file"),
    async (req, res) => {
      try {
        const user = getUserFromAuthHeader(req.headers.authorization);
        const tenant_id = req.body.tenant_id || user?.tenant_id;
        // Reuse GraphQL RBAC: requires auth, tenant match, and permission.
        authorize("uploadContractDocument", { tenant_id }, user);

        if (!req.file) {
          return res.status(400).json({ error: "No file provided (field: file)" });
        }

        const contract = await prisma.contract.findFirst({
          where: { contract_id: req.params.contractId, tenant_id },
        });
        if (!contract) {
          return res.status(404).json({ error: "Contract not found" });
        }

        const stored = await storeFile({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
        });

        const updated = await prisma.contract.update({
          where: { contract_id: contract.contract_id },
          data: { document_url: stored.url },
        });

        await writeAuditLog({
          tenant_id,
          user_id: user.user_id,
          action: "uploadContractDocument",
          metadata: { contract_id: contract.contract_id, document_url: stored.url },
        });

        return res.json({
          contract_id: updated.contract_id,
          document_url: updated.document_url,
        });
      } catch (err) {
        const code = err?.extensions?.code;
        if (code === "FORBIDDEN") return res.status(403).json({ error: err.message });
        console.error("[upload] error:", err.message);
        return res.status(500).json({ error: "Upload failed" });
      }
    }
  );

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

  // Optional in-process scheduler for long-lived hosts (e.g. Render). Serverless
  // deployments should instead invoke `npm run scheduler` from an external cron.
  // Set SCHEDULER_INTERVAL_MS (e.g. 86400000 for daily) to enable.
  const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS || 0);
  if (intervalMs > 0) {
    const tick = () =>
      runDailyJobs(prisma, { writeAuditLog })
        .then((s) =>
          console.log(`[scheduler] created ${s.created} reminder(s) across ${s.tenants} tenant(s).`)
        )
        .catch((err) => console.error("[scheduler] run failed:", err.message));
    tick();
    setInterval(tick, intervalMs);
  }
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
