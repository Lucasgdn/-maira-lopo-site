import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("refuses to start when the Firebase bot credentials are missing", () => {
  const env = { ...process.env };
  for (const name of ["BOT_FIREBASE_API_KEY", "BOT_FIREBASE_PROJECT_ID",
    "BOT_FIREBASE_AUTH_DOMAIN", "BOT_EMAIL", "BOT_PASSWORD"]) {
    delete env[name];
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./index.mjs", import.meta.url))], {
    encoding: "utf8",
    env,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Configuracao ausente/);
  assert.equal(result.stdout, "");
});
