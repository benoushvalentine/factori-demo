import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, closeSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
if (existsSync(".env")) process.loadEnvFile(".env");
process.env.DATABASE_URL ??= "file:./dev.db";
if (!process.env.DATABASE_URL.startsWith("file:"))
  throw new Error("This demo requires a SQLite file: DATABASE_URL.");
const database = resolve("prisma", process.env.DATABASE_URL.slice(5));
mkdirSync(dirname(database), { recursive: true });
// Prisma 6 requires an existing SQLite file before migrate deploy on this platform.
closeSync(openSync(database, "a"));
for (const args of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["--import", "tsx", "prisma/seed.ts"],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
