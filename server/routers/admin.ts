import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { users, documents } from "../../drizzle/schema.js";
import { desc, eq, and, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm.js";

const tierEnum = z.enum(["public", "invited", "owner"]);

export const adminRouter = router({
  users: router({
    list: adminProcedure.query(async () => {
      const db = getDb();
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      return rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        tier: u.tier,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
      }));
    }),

    setTier: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          tier: tierEnum,
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id && input.tier !== "owner") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot demote your own owner account.",
          });
        }
        const db = getDb();
        await db.update(users).set({ tier: input.tier }).where(eq(users.id, input.userId));
        return { success: true };
      }),
  }),

  /**
   * One-shot LLM-based backfill of documents.aboutCity for docs that don't
   * have a value yet OR that were assigned a value via the cheap entity
   * heuristic and are likely wrong. Replaces heuristic guesses with what the
   * LLM thinks based on title + content. Costs ~$0.02 at gpt-4o-mini for ~100
   * docs.
   */
  reanalyzeAboutCity: adminProcedure
    .input(z.object({ replaceExisting: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const where = input.replaceExisting ? undefined : isNull(documents.aboutCity);
      const docs = where
        ? await db.select({ id: documents.id, title: documents.title, content: documents.content }).from(documents).where(where)
        : await db.select({ id: documents.id, title: documents.title, content: documents.content }).from(documents);

      const VALID = [
        "Kingman",
        "Bullhead City",
        "Lake Havasu City",
        "Mohave County",
        "Phoenix Metro",
        "Flagstaff Area",
        "Tucson Metro",
        "Other Arizona",
        "Out of State",
      ] as const;
      let updated = 0;
      let totalTokens = 0;

      for (const doc of docs) {
        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: "You classify Arizona civic documents by which place they are PRIMARILY ABOUT. Be strict — incidental mentions don't count. Return only valid JSON." },
              {
                role: "user",
                content: `Title: ${doc.title}\n\nContent (truncated): ${doc.content.substring(0, 2500)}\n\nWhich place is this article PRIMARILY ABOUT? Return JSON: { "AboutCity": one of the enum values }.\n\nMohave County (primary coverage area):\n- 'Kingman' / 'Bullhead City' / 'Lake Havasu City' — ONLY when centrally about events/people/institutions in that specific city.\n- 'Mohave County' — county-wide stories OR smaller Mohave places (Fort Mohave, Mohave Valley, Laughlin, Golden Valley).\n\nArizona Wire (for the 'Across Arizona' section):\n- 'Phoenix Metro' — Phoenix, Scottsdale, Tempe, Mesa, Chandler, Gilbert, Glendale, Peoria, Goodyear, Surprise, Avondale, Buckeye, Maricopa, Apache Junction, Queen Creek, any other Maricopa County city.\n- 'Flagstaff Area' — Flagstaff, Sedona, Williams, Page, Coconino County.\n- 'Tucson Metro' — Tucson, Marana, Oro Valley, Sahuarita, Pima County.\n- 'Other Arizona' — anywhere else in Arizona (Prescott, Yuma, Sierra Vista, statewide stories not fitting a specific metro).\n\nOut of region:\n- 'Out of State' — anywhere outside Arizona (national news, other states, international).\n\nRules: An Arizona resident traveling out of state is NOT an Arizona story. A national story that mentions an Arizona person briefly is 'Out of State'. Pick based on where the event/story takes place, not where the source is based.`,
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
                    AboutCity: {
                      type: "string",
                      enum: [
                        "Kingman",
                        "Bullhead City",
                        "Lake Havasu City",
                        "Mohave County",
                        "Phoenix Metro",
                        "Flagstaff Area",
                        "Tucson Metro",
                        "Other Arizona",
                        "Out of State",
                      ],
                    },
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
              await db.update(documents).set({ aboutCity: parsed.AboutCity }).where(eq(documents.id, doc.id));
              updated++;
            }
          }
        } catch (err) {
          console.error(`[reanalyzeAboutCity] doc ${doc.id} failed:`, err instanceof Error ? err.message : err);
        }
      }

      return { scanned: docs.length, updated, totalTokens };
    }),
});
