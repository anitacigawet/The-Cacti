/**
 * Shared helpers for news/newspaper article rendering.
 */

/**
 * "Breaking" is a freshness claim. Articles tagged isBreaking that are more
 * than this many hours old are treated as no-longer-breaking client-side,
 * regardless of what the database says. This protects against legacy data
 * (old articles flagged under a looser prompt) and against future prompt
 * regressions.
 */
export const BREAKING_TTL_HOURS = 48;

export interface BreakingLike {
  isBreaking?: boolean | number | null;
  createdAt?: string | Date | null;
}

export function isStillBreaking(article: BreakingLike): boolean {
  if (!article.isBreaking) return false;
  if (!article.createdAt) return true;
  const ageHours = (Date.now() - new Date(article.createdAt).getTime()) / 3_600_000;
  return ageHours <= BREAKING_TTL_HOURS;
}
