import { and, eq, isNull, lte, or } from "drizzle-orm";
import { alertInstances, documents, type User } from "../../drizzle/schema.js";
import { effectiveTier, freshnessThreshold } from "./auth.js";

/** All public representations must use the same document-age boundary. */
export function visibleDocuments(user: User | null, now = Date.now()) {
  return lte(documents.createdAt, visibilityCutoff(user, now));
}

export function visibilityCutoff(user: User | null, now = Date.now()) {
  return freshnessThreshold(effectiveTier(user), now);
}

/** Preserve standalone alerts, but do not expose copies of withheld documents. */
export function visibleAlerts(user: User | null) {
  return and(
    lte(alertInstances.createdAt, visibilityCutoff(user)),
    or(isNull(alertInstances.documentId), and(eq(alertInstances.documentId, documents.id), visibleDocuments(user)))
  );
}
