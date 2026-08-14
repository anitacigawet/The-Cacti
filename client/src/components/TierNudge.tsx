import { useAuth } from "@/_core/hooks/useAuth";
import { Clock, ArrowRight, X } from "lucide-react";
import { useState, useEffect } from "react";

/**
 * Slim freshness nudge shown to anonymous (public-tier) and invited-tier
 * users. Hidden for owner. Single-line layout that fits in ~32px of
 * vertical space — used to be a chunky ~150px banner that ate viewport
 * on every page, especially on mobile.
 *
 * Dismissal persists for the session only (sessionStorage), so the
 * message comes back on a new visit without nagging during this one.
 */
const DISMISS_KEY = "cacti-tier-nudge-dismissed";

export function TierNudge() {
  const { tier, signInUrl } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }
  }, []);

  if (tier === "owner" || dismissed) return null;

  const isAnon = tier === "public";
  const message = isAnon ? "Data shown is 24h+ old." : "Data shown is 3h+ old.";
  const ctaText = isAnon ? "Sign in for fresher" : "Request real-time";

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-cacti-amber/30 bg-cacti-amber/5 mb-3 text-xs">
      <Clock className="h-3 w-3 text-cacti-amber shrink-0" />
      <span className="text-muted-foreground flex-1 min-w-0 truncate">{message}</span>
      {isAnon && (
        <button
          onClick={() => { window.location.href = signInUrl; }}
          className="text-cacti-amber hover:text-cacti-amber/80 transition-colors inline-flex items-center gap-1 shrink-0"
        >
          <span className="hidden sm:inline">{ctaText}</span>
          <span className="sm:hidden">Sign in</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
