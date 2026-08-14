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
