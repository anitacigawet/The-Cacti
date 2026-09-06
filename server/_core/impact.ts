/**
 * Normalize impact-level values from the LLM analysis JSON.
 *
 * The classification prompt instructs the model to return one of
 * "High" | "Medium" | "Low", but the LLM occasionally leaks a topic
 * string (e.g. "Community Engagement") into that field. Surfacing those
 * as styled impact tags is worse than not surfacing impact at all —
 * this helper enforces the constraint at the API boundary so consumers
 * (client tags, alert rules, sort logic) only ever see a valid value
 * or null.
 */
import { sql } from "drizzle-orm";
import { documents } from "../../drizzle/schema.js";

const VALID = new Set(["High", "Medium", "Low"]);

export type ImpactLevel = "High" | "Medium" | "Low";

export function normalizeImpact(value: unknown): ImpactLevel | null {
  if (typeof value !== "string") return null;
  // Accept any case but return the canonical capitalization.
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase();
  return VALID.has(normalized) ? (normalized as ImpactLevel) : null;
}

/** Same canonical/legacy rule as the document response, evaluated before pagination. */
export function documentImpact() {
  // SQLite's default trim removes only ASCII spaces; match String.trim exactly.
  const whitespace = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
  return sql<string | null>`CASE lower(trim(json_extract(${documents.analysis}, '$."Impact Level"'), ${whitespace}))
    WHEN 'high' THEN 'High' WHEN 'medium' THEN 'Medium' WHEN 'low' THEN 'Low'
    ELSE CASE WHEN ${documents.impactLevel} = 1 THEN 'High' WHEN ${documents.impactLevel} = 0 THEN 'Low'
      WHEN ${documents.impactLevel} IS NOT NULL THEN 'Medium' ELSE NULL END END`;
}
