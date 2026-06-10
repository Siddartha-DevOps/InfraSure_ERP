// File-storage adapter for InfraSure ERP.
// Phase 1 uses local disk; the same interface is ready for an S3 driver later
// (set STORAGE_DRIVER=s3 and implement the branch). Resolvers/REST routes only
// ever call storeFile() / publicUrl(), so swapping drivers is a one-file change.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DRIVER = process.env.STORAGE_DRIVER || "local";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve("uploads");
const PUBLIC_PATH = "/files";

// Stores a file buffer and returns a URL the client can use to retrieve it.
export async function storeFile({ buffer, originalName, mimetype }) {
  const safeName = `${randomUUID()}-${path.basename(originalName || "file")}`;

  if (DRIVER === "local") {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, safeName), buffer);
    return { key: safeName, url: `${PUBLIC_PATH}/${safeName}`, mimetype };
  }

  // S3-ready stub — implement when moving off local disk.
  throw new Error(`Unsupported STORAGE_DRIVER: ${DRIVER}`);
}

export const storageConfig = { DRIVER, UPLOAD_DIR, PUBLIC_PATH };
