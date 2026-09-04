import { useEffect } from "react";
import { useLocation } from "wouter";

// Compatibility route for existing /ingestion links. The active Data Monitor
// surface lives in Settings. Keep this redirect until an explicit routing
// decision removes backward compatibility.
export default function Ingestion() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/settings?tab=data-monitor", { replace: true });
  }, [setLocation]);
  return null;
}
