import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import app, { resumeSalesSimulations } from "./app.js";
import { db } from "./db.js";
const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
}
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () => {
  void resumeSalesSimulations().catch(console.error);
  console.log(
    `Factori API${existsSync(dist) ? " + app" : ""}: http://${host}:${port}`,
  );
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () =>
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    }),
  );
