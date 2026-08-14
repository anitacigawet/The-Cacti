import { useEffect } from "react";
import { useLocation } from "wouter";

// /ingestion is preserved as a redirect to /settings?tab=data-monitor.
// The Ingestion surface lives inside Settings as "Data Monitor" as of
// B3 (DECISIONS.md D-011). Keep this redirect for a few weeks to catch
// bookmarks, then hard-delete the route.
export default function Ingestion() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/settings?tab=data-monitor", { replace: true });
  }, [setLocation]);
  return null;
}
