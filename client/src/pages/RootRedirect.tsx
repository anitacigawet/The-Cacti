import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Hexagon, Radio } from "lucide-react";

/**
 * "/" is just a router junction. Authenticated users land on /dashboard;
 * anonymous visitors land on /newspaper (Phase C: the most user-friendly
 * entry that showcases the product). The marketing splash lives at /about
 * for anyone who wants to read about what this is.
 */
export default function RootRedirect() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    setLocation(import.meta.env.VITE_SHOWROOM_MODE === "1" ? "/newspaper" : user ? "/dashboard" : "/newspaper");
  }, [loading, user, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Hexagon className="h-12 w-12 text-primary animate-cacti-glow-pulse" />
        <div className="flex items-center gap-2">
          <Radio className="h-3 w-3 text-cacti-green cacti-pulse" />
          <span
            className="text-xs text-muted-foreground tracking-widest uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Routing...
          </span>
        </div>
      </div>
    </div>
  );
}
