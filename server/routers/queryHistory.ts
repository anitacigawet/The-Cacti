import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc.js";
// queryHistory holds owner-only Q&A data — every endpoint is admin.
import { getDb } from "../db.js";
import { queryHistory } from "../../drizzle/schema.js";
import { desc, eq } from "drizzle-orm";

export const queryHistoryRouter = router({
  list: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }))
    .query(async ({ input }) => {
      return await getDb()
        .select()
        .from(queryHistory)
        .orderBy(desc(queryHistory.createdAt))
        .limit(input.limit);
    }),

  save: adminProcedure
    .input(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        tokensUsed: z.number().default(0),
        sourcesConsulted: z.number().default(0),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await getDb().insert(queryHistory).values({
        question: input.question,
        answer: input.answer,
        tokensUsed: input.tokensUsed,
        sourcesConsulted: input.sourcesConsulted,
        model: input.model ?? null,
      });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(queryHistory).where(eq(queryHistory.id, input.id));
      return { success: true };
    }),

  clearAll: adminProcedure.mutation(async () => {
    await getDb().delete(queryHistory);
    return { success: true };
  }),
});
