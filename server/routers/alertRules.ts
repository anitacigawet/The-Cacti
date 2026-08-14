import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { alertRules, alertInstances, documents } from "../../drizzle/schema.js";
import { eq, desc, and, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification.js";

const alertRuleConfigSchema = z.object({
  keywords: z.array(z.string()).optional(),
  threshold: z.number().optional(),
  cities: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  impactLevel: z.string().optional(),
});

export const alertRulesRouter = router({
  list: publicProcedure.query(async () => {
    return await getDb().select().from(alertRules).orderBy(desc(alertRules.createdAt));
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        type: z.enum(["keyword", "sentiment_threshold", "impact_level", "anomaly"]),
        config: alertRuleConfigSchema,
        severity: z.enum(["critical", "warning", "info"]).default("warning"),
      })
    )
    .mutation(async ({ input }) => {
      await getDb().insert(alertRules).values({
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        config: input.config,
        severity: input.severity,
      });
      return { success: true };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        config: alertRuleConfigSchema.optional(),
        severity: z.enum(["critical", "warning", "info"]).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updateSet: Record<string, unknown> = {};
      if (input.name !== undefined) updateSet.name = input.name;
      if (input.description !== undefined) updateSet.description = input.description;
      if (input.config !== undefined) updateSet.config = input.config;
      if (input.severity !== undefined) updateSet.severity = input.severity;
      if (input.enabled !== undefined) updateSet.enabled = input.enabled;

      if (Object.keys(updateSet).length > 0) {
        await getDb().update(alertRules).set(updateSet).where(eq(alertRules.id, input.id));
      }
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(alertInstances).where(eq(alertInstances.ruleId, input.id));
      await db.delete(alertRules).where(eq(alertRules.id, input.id));
      return { success: true };
    }),

  instances: publicProcedure
    .input(
      z.object({
        status: z.enum(["active", "acknowledged", "resolved", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      if (input.status === "all") {
        return await db.select().from(alertInstances).orderBy(desc(alertInstances.createdAt)).limit(input.limit);
      }
      return await db
        .select()
        .from(alertInstances)
        .where(eq(alertInstances.status, input.status))
        .orderBy(desc(alertInstances.createdAt))
        .limit(input.limit);
    }),

  acknowledge: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(alertInstances)
        .set({ status: "acknowledged", acknowledgedAt: new Date() })
        .where(eq(alertInstances.id, input.id));
      return { success: true };
    }),

  resolve: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(alertInstances)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(alertInstances.id, input.id));
      return { success: true };
    }),

  evaluate: adminProcedure.mutation(async () => {
    const db = getDb();
    const rules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.enabled, true));

    if (rules.length === 0) return { evaluated: 0, newAlerts: 0 };

    const docs = await db
      .select()
      .from(documents)
      .where(sql`${documents.analysis} IS NOT NULL`)
      .orderBy(desc(documents.publishedAt))
      .limit(100);

    const existingAlerts = await db.select({ documentId: alertInstances.documentId }).from(alertInstances);
    const existingDocIds = new Set(existingAlerts.map((a) => a.documentId).filter(Boolean));

    let newAlerts = 0;
    const criticalAlerts: string[] = [];

    for (const doc of docs) {
      if (existingDocIds.has(doc.id)) continue;

      const analysis = doc.analysis as Record<string, any> | null;
      if (!analysis) continue;

      for (const rule of rules) {
        const config = rule.config as Record<string, any>;
        let triggered = false;

        switch (rule.type) {
          case "keyword": {
            const keywords: string[] = config?.keywords || [];
            const content = `${doc.title} ${analysis.Summary || ""} ${(doc.topics as string[] | null)?.join(" ") || ""}`.toLowerCase();
            triggered = keywords.some((kw) => content.includes(kw.toLowerCase()));
            break;
          }
          case "sentiment_threshold": {
            const threshold = (config?.threshold as number) ?? 0.3;
            const score = (analysis.Sentiment?.Score as number) ?? 0.5;
            triggered = score < threshold;
            break;
          }
          case "impact_level": {
            const targetLevel = (config?.impactLevel as string) || "High";
            triggered = analysis["Impact Level"] === targetLevel;
            break;
          }
          case "anomaly": {
            triggered = analysis["Impact Level"] === "High" && doc.sentiment === "negative";
            break;
          }
        }

        if (triggered && (config?.cities as string[] | undefined)?.length) {
          triggered = (config.cities as string[]).includes(doc.city);
        }
        if (triggered && (config?.sources as string[] | undefined)?.length) {
          triggered = (config.sources as string[]).includes(doc.source);
        }

        if (triggered) {
          await db.insert(alertInstances).values({
            ruleId: rule.id,
            documentId: doc.id,
            title: `[${rule.name}] ${doc.title}`,
            summary: analysis.Summary ?? "",
            severity: rule.severity,
            status: "active",
            type: rule.type,
            city: doc.city,
            source: doc.source,
          });
          newAlerts++;
          existingDocIds.add(doc.id);

          if (rule.severity === "critical") {
            criticalAlerts.push(`[${rule.name}] ${doc.title} (${doc.city})`);
          }
        }
      }
    }

    if (criticalAlerts.length > 0) {
      try {
        await notifyOwner({
          title: `Cacti Alert: ${criticalAlerts.length} Critical Alert${criticalAlerts.length > 1 ? "s" : ""} Detected`,
          content: `The Cacti Intelligence System has detected ${criticalAlerts.length} critical alert(s):\n\n${criticalAlerts.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nTotal documents evaluated: ${docs.length}\nNew alerts: ${newAlerts}`,
        });
      } catch (err) {
        console.warn("[AlertRules] Notification failed:", err);
      }
    }

    return { evaluated: docs.length, newAlerts, rulesChecked: rules.length, criticalNotified: criticalAlerts.length };
  }),

  stats: publicProcedure.query(async () => {
    const db = getDb();
    const [instances, rules] = await Promise.all([
      db.select({ status: alertInstances.status, count: sql<number>`COUNT(*)` }).from(alertInstances).groupBy(alertInstances.status),
      db.select({ count: sql<number>`COUNT(*)` }).from(alertRules),
    ]);

    const counts: Record<string, number> = { active: 0, acknowledged: 0, resolved: 0 };
    for (const row of instances) {
      counts[row.status] = Number(row.count);
    }

    return {
      active: counts.active,
      acknowledged: counts.acknowledged,
      resolved: counts.resolved,
      total: counts.active + counts.acknowledged + counts.resolved,
      rules: Number(rules[0]?.count || 0),
    };
  }),
});
