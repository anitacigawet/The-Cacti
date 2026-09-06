import assert from "node:assert/strict";
import test from "node:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer, get } from "node:http";
import express from "express";

test("actual Vite wrapper denies private files, hostile hosts, Windows aliases and UNC editor paths", async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const fixture = mkdtempSync(path.join(tmpdir(), "cacti-vite-test-"));
  const app = express();
  const server = createServer(app);
  let vite: import("vite").ViteDevServer | undefined;
  for (const dir of ["server/_core", "client/src", "client/public", "shared", "data"]) mkdirSync(path.join(fixture, dir), { recursive: true });
  for (const file of ["vite.config.ts", "server/_core/vite.ts"]) copyFileSync(path.join(root, file), path.join(fixture, file));
  writeFileSync(path.join(fixture, "package.json"), '{"type":"module"}');
  writeFileSync(path.join(fixture, "client/index.html"), '<div id="root">Fixture</div><script type="module" src="/src/main.tsx"></script>');
  writeFileSync(path.join(fixture, "client/src/main.tsx"), 'import { region } from "@shared/region"; document.title = region;');
  writeFileSync(path.join(fixture, "shared/region.ts"), 'export const region = "CACTI_SHARED_CONTROL";');
  const canary = "SYNTHETIC_PRIVATE_MARKER_NOT_A_SECRET";
  for (const file of ["data/settings.json", "data/app.db", "client/test.pem", "client/.env", "server/private.ts"]) writeFileSync(path.join(fixture, file), canary);
  const dependencies = path.join(fixture, "node_modules");
  symlinkSync(path.join(root, "node_modules"), dependencies, process.platform === "win32" ? "junction" : "dir");
  t.after(async () => {
    await vite?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // Detach only this test's dependency link before removing its verified fixture.
    unlinkSync(dependencies);
    assert.equal(path.dirname(fixture), path.resolve(tmpdir()));
    assert.ok(path.basename(fixture).startsWith("cacti-vite-test-"));
    rmSync(fixture, { recursive: true, force: true });
  });
  const { setupVite } = await import(pathToFileURL(path.join(fixture, "server/_core/vite.ts")).href);
  vite = await setupVite(app, server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const fsPath = (file: string) => `/@fs/${path.join(fixture, file).replaceAll("\\", "/")}`;
  assert.equal(vite.config.server.fs.strict, true);
  assert.notEqual(vite.config.server.allowedHosts, true);
  const hostileStatus = await new Promise<number | undefined>((resolve, reject) => {
    get(`${base}/src/main.tsx`, { headers: { Host: "untrusted.example.invalid" } }, (response) => {
      response.resume(); resolve(response.statusCode);
    }).on("error", reject);
  });
  assert.equal(hostileStatus, 403);
  for (const url of [fsPath("data/settings.json"), `${fsPath("data/settings.json")}?raw`, fsPath("data/app.db"), fsPath("server/private.ts"), "/test.pem?raw", "/.env?raw", "/test.pem::$DATA?raw", "/test.pem%3A%3A%24DATA?raw", "/@fs/UNC/example.invalid/share/test?raw"]) {
    const response = await fetch(base + url);
    const body = await response.text();
    assert.ok(!body.includes(canary), url);
    // Unrecognized encodings may hit the SPA fallback, but must never return the file.
    assert.ok(response.status >= 400 || (response.status === 200 && body.includes('<div id="root">Fixture</div>')), `${url}: ${response.status}`);
  }
  // Patched editor rejects UNC before filesystem/network access; no SMB listener or credentials involved.
  const editor = await fetch(base + "/__open-in-editor?file=" + encodeURIComponent("\\\\example.invalid\\share\\fixture.ts"));
  assert.equal(editor.status, 403);
  const page = await fetch(base + "/about");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Fixture/);
  const script = await fetch(base + "/src/main.tsx");
  assert.equal(script.status, 200);
  assert.match(await script.text(), /document.title/);
  const shared = await fetch(base + fsPath("shared/region.ts"));
  assert.equal(shared.status, 200);
  assert.match(await shared.text(), /CACTI_SHARED_CONTROL/);
});
