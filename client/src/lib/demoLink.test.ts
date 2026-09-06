import assert from "node:assert/strict";
import test from "node:test";
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import { createDemoLink } from "./demoLink.ts";
import { loadAllDocumentPages } from "./document-views.ts";

test("showroom complete loading, impact drilldown and digest stay inside the local adapter", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Showroom attempted a network request"); });
  const client = createTRPCClient<AppRouter>({ links: [createDemoLink()] });
  const all = await loadAllDocumentPages((input) => client.documents.list.query(input));
  assert.equal(all.length, 6);
  const high = await client.documents.list.query({ impactLevel: "High", limit: 100 });
  assert.equal(high.total, 2);
  assert.equal(high.items.every((item) => item.impactLevel === "High"), true);
  assert.equal(high.items.some((item) => !`${item.title} ${item.content}`.includes("High impact")), true);
  const digest = await client.ingestion.sendDigest.mutate();
  assert.equal(digest.sent, false);
});
