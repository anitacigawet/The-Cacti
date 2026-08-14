/**
 * Re-classifies every document's aboutCity under the expanded "Mohave +
 * Arizona Wire" taxonomy. Adds Arizona neighbor metros (Phoenix Metro,
 * Flagstaff Area, Tucson Metro, Other Arizona) and a clean Out of State
 * bucket. Replaces the previous binary "Mohave city OR Out of Region"
 * model so the Newspaper page can run a secondary "Across Arizona" wire
 * section without the data being wasted.
 *
 * Cost: ~$0.015 per ~300 docs at gpt-4o-mini.
 *
 * Run: pnpm tsx scripts/reanalyze-about-city.ts
 */

import "dotenv/config";
import { initDb, getDb } from "../server/db.js";
import { documents } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../server/_core/llm.js";

const VALID = [
  // Mohave County (primary editions)
  "Kingman",
  "Bullhead City",
  "Lake Havasu City",
  "Mohave County",
  // Arizona Wire (secondary "Across Arizona" editions)
  "Phoenix Metro",
  "Flagstaff Area",
  "Tucson Metro",
  "Other Arizona",
  // Truly out of region
  "Out of State",
] as const;

async function main() {
  await initDb();
  const db = getDb();

  const docs = await db
    .select({ id: documents.id, title: documents.title, content: documents.content, aboutCity: documents.aboutCity })
    .from(documents);

  console.log(`[reanalyze-about-city] Found ${docs.length} documents to re-classify`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let totalTokens = 0;
  const distribution: Record<string, number> = {};

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    try {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You classify Arizona civic documents by which place they are PRIMARILY ABOUT. Be strict — incidental mentions don't count. Return only valid JSON.",
          },
          {
            role: "user",
            content: `Title: ${doc.title}\n\nContent (truncated): ${doc.content.substring(0, 2500)}\n\nWhich place is this article PRIMARILY ABOUT? Return JSON: { "AboutCity": one of the enum values }.\n\nMohave County (primary coverage area):\n- 'Kingman' / 'Bullhead City' / 'Lake Havasu City' — ONLY when the event/story is centrally located in that specific city.\n- 'Mohave County' — county-wide stories OR smaller Mohave places (Fort Mohave, Mohave Valley, Laughlin, Golden Valley).\n\nArizona Wire (broader Arizona — for the 'Across Arizona' section):\n- 'Phoenix Metro' — Phoenix, Scottsdale, Tempe, Mesa, Chandler, Gilbert, Glendale, Peoria, Goodyear, Surprise, Avondale, Buckeye, Maricopa, Apache Junction, Queen Creek, any other Maricopa County city.\n- 'Flagstaff Area' — Flagstaff, Sedona, Williams, Page, Coconino County.\n- 'Tucson Metro' — Tucson, Marana, Oro Valley, Sahuarita, Pima County.\n- 'Other Arizona' — anywhere else in Arizona (Prescott, Yuma, Sierra Vista, Lake Havasu's broader county neighbors that aren't in the metros above, statewide stories that don't fit a specific metro).\n\nOut of region:\n- 'Out of State' — anywhere outside Arizona (national news, other states, international).\n\nRules: An Arizona resident traveling out of state is NOT an Arizona story unless the story is about them at home. A national story that mentions an Arizona person briefly is 'Out of State'. Pick based on where the event/story takes place, not where the source is based.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "about_city",
            strict: true,
            schema: {
              type: "object",
              properties: {
                AboutCity: { type: "string", enum: [...VALID] },
              },
              required: ["AboutCity"],
              additionalProperties: false,
            },
          },
        },
      });
      totalTokens += result.usage?.total_tokens || 0;
      const c = result.choices[0]?.message?.content;
      if (typeof c === "string") {
        const parsed = JSON.parse(c) as { AboutCity?: string };
        if (parsed.AboutCity && (VALID as readonly string[]).includes(parsed.AboutCity)) {
          if (parsed.AboutCity !== doc.aboutCity) {
            await db.update(documents).set({ aboutCity: parsed.AboutCity }).where(eq(documents.id, doc.id));
            updated++;
          } else {
            unchanged++;
          }
          distribution[parsed.AboutCity] = (distribution[parsed.AboutCity] || 0) + 1;
        }
      }
      if ((i + 1) % 25 === 0) {
        console.log(`  Progress: ${i + 1}/${docs.length}`);
      }
    } catch (err) {
      failed++;
      console.error(`  [${i + 1}/${docs.length}] doc ${doc.id} FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n[reanalyze-about-city] Done`);
  console.log(`  Scanned:   ${docs.length}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Tokens:    ${totalTokens}`);
  console.log(`\nNew distribution:`);
  for (const [city, count] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${city.padEnd(20)}: ${count}`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
