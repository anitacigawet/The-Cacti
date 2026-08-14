import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getUserFromRequest } from "./auth.js";
import type { User } from "../../drizzle/schema.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const user = await getUserFromRequest(opts.req).catch(() => null);
  return { req: opts.req, res: opts.res, user };
}
