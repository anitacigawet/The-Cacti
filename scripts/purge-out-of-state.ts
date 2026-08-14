/**
 * One-shot cleanup: delete documents classified as 'Out of State' from the
 * corpus. They never appear in any newspaper edition (Mohave or Arizona
 * Wire), they clutter the Documents listing, and the new pre-flight filter
 * prevents future ones from being ingested. With ingest now Arizona-only,
 * keeping these is dead weight.
 *
 * Cascade-safe: documentEntities + alertInstances reference documentId, so
 * we delete them first to satisfy FK constraints (the schema doesn't enforce
 * cascade by default on SQLite, so we do it explicitly).
 *
 * Run: pnpm tsx scripts/purge-out-of-state.ts
 */

import "dotenv/config";
import { initDb, getDb } from "../server/db.js";
import { documents, documentEntities, alertInstances } from "../drizzle/schema.js";
import { eq, inArray } from "drizzle-orm";

async function main() {
  await initDb();
  const db = getDb();

  const oos = await db
    .select({ id: documents.id, title: documents.title, source: documents.source })
    .from(documents)
    .where(eq(documents.aboutCity, "Out of State"));

  if (oos.length === 0) {
    console.log("[purge-out-of-state] No Out of State docs to delete.");
    return;
  }

  const ids = oos.map((d) => d.id);
  console.log(`[purge-out-of-state] Found ${oos.length} Out of State documents to purge.`);
  console.log("Sample (first 5):");
  for (const d of oos.slice(0, 5)) {
    console.log(`  ${d.id}: "${d.title.substring(0, 60)}..." (${d.source})`);
  }

  // FK cleanup first
  const entitiesDeleted = await db.delete(documentEntities).where(inArray(documentEntities.documentId, ids));
  const alertsDeleted = await db.delete(alertInstances).where(inArray(alertInstances.documentId, ids));
  const docsDeleted = await db.delete(documents).where(inArray(documents.id, ids));

  console.log(`\n[purge-out-of-state] Cleanup complete:`);
  console.log(`  Documents deleted:        ${oos.length}`);
  console.log(`  documentEntities deleted: (cascade)`);
  console.log(`  alertInstances deleted:   (cascade)`);

  // Quick post-state report
  const remaining = await db.select({ id: documents.id }).from(documents);
  console.log(`\n  Remaining documents:      ${remaining.length}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
