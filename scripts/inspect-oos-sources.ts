/**
 * Quick discovery: where do "Out of State" docs come from? Helps decide
 * whether to filter at the source level (disable a noisy feed) or
 * content level (per-doc Arizona check during ingestion).
 *
 * Run: pnpm tsx scripts/inspect-oos-sources.ts
 */

import "dotenv/config";
import { initDb, getDb } from "../server/db.js";
import { documents } from "../drizzle/schema.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  await initDb();
  const db = getDb();

  // Source breakdown for Out of State docs
  const oos = await db
    .select({
      source: documents.source,
      count: sql<number>`COUNT(*)`,
    })
    .from(documents)
    .where(eq(documents.aboutCity, "Out of State"))
    .groupBy(documents.source);

  // Source breakdown overall (for ratios)
  const total = await db
    .select({
      source: documents.source,
      count: sql<number>`COUNT(*)`,
    })
    .from(documents)
    .groupBy(documents.source);

  console.log("\nSOURCE BREAKDOWN — Out of State docs vs. total per source:\n");
  console.log("Source".padEnd(28), "OOS  ", "TOTAL", "OOS%");
  console.log("─".repeat(60));

  const totalMap = new Map(total.map((r) => [r.source, r.count]));
  const sorted = oos.sort((a, b) => b.count - a.count);

  for (const row of sorted) {
    const tot = totalMap.get(row.source) || 0;
    const pct = tot > 0 ? Math.round((row.count / tot) * 100) : 0;
    console.log(
      String(row.source || "—").padEnd(28),
      String(row.count).padStart(4),
      String(tot).padStart(5),
      `${pct}%`.padStart(5)
    );
  }

  const totalOos = oos.reduce((s, r) => s + r.count, 0);
  const totalAll = total.reduce((s, r) => s + r.count, 0);
  console.log("─".repeat(60));
  console.log(`Total OOS: ${totalOos} / ${totalAll} docs (${Math.round(totalOos / totalAll * 100)}%)`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
