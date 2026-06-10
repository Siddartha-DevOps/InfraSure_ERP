// Shared Prisma client singleton for the InfraSure ERP monorepo.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__infrasurePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__infrasurePrisma = prisma;
}

export default prisma;
