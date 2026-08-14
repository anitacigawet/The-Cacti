import { useEffect } from "react";
import { useLocation } from "wouter";

// /alerts is preserved as a redirect to /settings?tab=alerts. The Alerts
// surface lives inside Settings as of B4 (DECISIONS.md D-007). Keep this
// redirect for a few weeks to catch bookmarks, then hard-delete the route.
export default function Alerts() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/settings?tab=alerts", { replace: true });
  }, [setLocation]);
  return null;
}
