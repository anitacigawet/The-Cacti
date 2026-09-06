import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Supply a NEW staged runtime, never an existing installation.
const root = path.resolve(process.argv[2] ?? "");
assert.ok(process.argv[2] && existsSync(path.join(root, "dist/index.js")), "Expected a staged runtime path");
assert.ok(!existsSync(path.join(root, "data")) && !existsSync(path.join(root, ".env")), "Refusing existing runtime data/configuration");
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: root, windowsHide: true,
  env: { ...process.env, NODE_ENV: "production", PORT: String(port), PUBLIC_URL: `http://127.0.0.1:${port}`,
    DATABASE_PATH: "./data/app.db", JWT_SECRET: "", OWNER_EMAIL: "", GOOGLE_OAUTH_CLIENT_ID: "", GOOGLE_OAUTH_CLIENT_SECRET: "",
    GEMINI_API_KEY: "", OPENAI_API_KEY: "", DEEPSEEK_API_KEY: "", RESEND_API_KEY: "", RESEND_FROM_EMAIL: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
try {
  const deadline = Date.now() + 20_000;
  while (!output.includes("Server running on")) {
    if (child.exitCode != null || Date.now() > deadline) throw new Error(`Runtime failed to start: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  const page = await fetch(`${base}/about`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<div id="root">/);
  const asset = html.match(/src="([^" ]+\.js)"/)[1];
  const js = await fetch(new URL(asset, base));
  assert.equal(js.status, 200);
  assert.ok((await js.text()).length > 100);
  const oauth = await fetch(`${base}/api/auth/google/callback?error=%3Csvg%20onload%3Dalert(1)%3E`);
  assert.equal(oauth.status, 400);
  assert.match(oauth.headers.get("content-type"), /^text\/plain/);
  for (const route of ["/data/app.db", "/@fs/data/app.db", "/__open-in-editor?file=test"]) {
    const response = await fetch(base + route);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(await response.text(), /<div id="root">/);
  }
  const require = createRequire(path.join(root, "package.json"));
  const SQL = await require("sql.js")();
  const db = new SQL.Database(readFileSync(path.join(root, "data/app.db")));
  assert.equal(db.exec("SELECT count(*) FROM __drizzle_migrations")[0].values[0][0], 3);
  assert.equal(db.exec("SELECT count(*) FROM documents")[0].values[0][0], 0);
  assert.equal(db.exec("SELECT count(*) FROM ingestion_schedule WHERE enabled = 1")[0].values[0][0], 0);
  db.close();
  console.log(JSON.stringify({ productionSmoke: "passed", root, port, health: true, spa: true, asset: true, oauthPlainText: true, devRoutesAbsent: true, migrations: 3, freshDatabase: true, schedulerDisabled: true }));
} finally {
  child.kill();
  if (child.exitCode == null) await new Promise((resolve) => child.once("exit", resolve));
}
