import { useEffect } from "react";
import { useLocation } from "wouter";

// Compatibility route for existing /alerts links. The active Alerts surface
// lives in Settings. Keep this redirect until an explicit routing decision
// removes backward compatibility.
export default function Alerts() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/settings?tab=alerts", { replace: true });
  }, [setLocation]);
  return null;
}
