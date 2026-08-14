import { publicProcedure, router } from "../_core/trpc.js";
import { clearSessionCookie } from "../_core/auth.js";
import type { UserTier } from "../../drizzle/schema.js";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) {
      return {
        authenticated: false as const,
        user: null,
        tier: "public" as UserTier,
      };
    }
    return {
      authenticated: true as const,
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        name: ctx.user.name,
        avatarUrl: ctx.user.avatarUrl,
        tier: ctx.user.tier as UserTier,
      },
      tier: ctx.user.tier as UserTier,
    };
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.res);
    return { success: true };
  }),
});
