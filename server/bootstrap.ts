import { mkdirSync, closeSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { db, RETAILER_ID } from "./db.js";
import { seed } from "../prisma/seed.js";

// Initialize a new deployment once; ordinary restarts preserve existing data.
const url = process.env.DATABASE_URL!;
if (!url.startsWith("file:"))
  throw new Error("This build requires a SQLite file: DATABASE_URL.");
const database = resolve("prisma", url.slice(5));
mkdirSync(dirname(database), { recursive: true });
closeSync(openSync(database, "a"));
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    env: process.env,
    stdio: "inherit",
  },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
if (!(await db.retailer.findUnique({ where: { id: RETAILER_ID } })))
  await seed();
await import("./index.js");
