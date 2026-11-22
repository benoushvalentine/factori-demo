import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
// Also works without a checked-in .env. Prisma resolves this path relative to its schema.
process.env.DATABASE_URL ??= "file:./dev.db";
export const db = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  transactionOptions: { maxWait: 10000, timeout: 20000 },
});
export const RETAILER_ID = "style-studio";

// SQLite has one writer. The HTTP request queue alone does not serialize the
// parallel customer jobs within a campaign, or connection-sync GET requests.
let databaseWrites = Promise.resolve();
export async function serializeDatabaseWrite<T>(
  work: () => Promise<T>,
): Promise<T> {
  const previous = databaseWrites;
  let release!: () => void;
  databaseWrites = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}
