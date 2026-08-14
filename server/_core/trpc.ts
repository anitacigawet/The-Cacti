import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

/** Open to anonymous visitors. */
export const publicProcedure = t.procedure;

/** Requires a signed-in user (any tier). */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign-in required." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Requires the owner tier. */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign-in required." });
  }
  if (ctx.user.tier !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
