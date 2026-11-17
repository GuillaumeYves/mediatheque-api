import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Applique les migrations sur la base de test avant toute suite.
export function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  // Garde-fou : jamais de test sur une base dont le nom n'indique pas un usage de test.
  if (!/test/i.test(new URL(databaseUrl).pathname)) {
    throw new Error("DATABASE_URL doit désigner une base de test (nom contenant « test »)");
  }
  const prismaCli = require.resolve("prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit", env: process.env });
}
