// Cron entrypoint for the daily compliance scheduler.
// Invoke once a day from your scheduler of choice (system cron, GitHub Actions
// cron, Render Cron Job, Vercel Cron, etc.):
//
//   npm run scheduler --workspace apps/api
//
// It scans every tenant for GST filings due tomorrow and creates proactive
// reminders, then exits. Safe to run repeatedly (idempotent per day).
import "dotenv/config";
import prisma from "@infrasure/db";
import { connectMongo, writeAuditLog } from "./mongo.js";
import { runDailyJobs } from "./scheduler.js";

async function main() {
  await connectMongo().catch((err) =>
    console.error("[scheduler] Mongo not ready — audit logging will be skipped:", err.message)
  );
  const summary = await runDailyJobs(prisma, { writeAuditLog });
  console.log(
    `[scheduler] daily run complete — scanned ${summary.tenants} tenant(s), created ${summary.created} reminder(s).`
  );
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}

main().catch((err) => {
  console.error("[scheduler] failed:", err);
  process.exit(1);
});
