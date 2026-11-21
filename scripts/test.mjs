import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, closeSync, openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "factori-tests-"));
closeSync(openSync(join(directory, "test.db"), "a"));
const env = {
  ...process.env,
  AI_MODE: "mock",
  NODE_ENV: "test",
  DATABASE_URL: `file:${join(directory, "test.db")}`,
};
let code = 1;
try {
  const migration = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, stdio: "inherit" },
  );
  if (migration.status === 0) {
    code =
      spawnSync(
        process.execPath,
        ["--import", "tsx", "--test", "tests/workflow.test.ts"],
        { env, stdio: "inherit" },
      ).status ?? 1;
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
process.exitCode = code;
