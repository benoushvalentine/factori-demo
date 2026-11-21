import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
// Also works without a checked-in .env. Prisma resolves this path relative to its schema.
process.env.DATABASE_URL ??= "file:./dev.db";
export const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
export const RETAILER_ID = "style-studio";
