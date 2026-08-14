import { Database, Sparkles } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Shown when the database has zero analyzed documents — typically a fresh
 * install before the ingestion pipeline has run. Owner sees an actionable
 * message; non-owners see a more reassuring "still loading" version.
 */
export function NoDataBanner({ totalDocuments }: { totalDocuments: number }) {
  const { isOwner } = useAuth();
  if (totalDocuments > 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 rounded-lg border border-cacti-cyan/30 bg-cacti-cyan/5 mb-4">
      <Database className="h-4 w-4 text-cacti-cyan shrink-0 mt-0.5 sm:mt-0" />
      <p className="text-sm text-foreground flex-1">
        <span className="font-medium">No civic data ingested yet.</span>{" "}
        <span className="text-muted-foreground">
          {isOwner
            ? "Visit Ingestion → seed sources, or run an ingestion pass to populate the dashboard."
            : "The site is still gathering its first batch of public-record data. Check back shortly."}
        </span>
      </p>
    </div>
  );
}

/**
 * Shown to invited-tier users whose 3-hour-old data hasn't arrived yet —
 * common in the first hours after a fresh deploy when most documents are
 * still inside the 3-hour cutoff.
 */
export function TierThrottledBanner({ visibleCount }: { visibleCount: number }) {
  const { tier, isOwner } = useAuth();
  if (isOwner) return null;
  if (visibleCount > 0) return null;

  const isAnon = tier === "public";
  const message = isAnon
    ? "Most recent data is less than 24 hours old. Sign in for 3-hour-fresh access, or check back later."
    : "Most recent data is less than 3 hours old. Check back soon, or contact the project owner for real-time access.";

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-cacti-amber/30 bg-cacti-amber/5 mb-4">
      <Sparkles className="h-4 w-4 text-cacti-amber shrink-0 mt-0.5" />
      <p className="text-sm text-muted-foreground flex-1">{message}</p>
    </div>
  );
}
