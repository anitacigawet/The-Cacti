import { useState, useEffect, useCallback, useRef } from "react";

export type SSEEvent = {
  type: string;
  data: any;
  timestamp: string;
};

export type SSEStatus = "connecting" | "connected" | "disconnected" | "error";

export function useSSE() {
  const showroom = import.meta.env.VITE_SHOWROOM_MODE === "1";
  const [status, setStatus] = useState<SSEStatus>(showroom ? "connected" : "disconnected");
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (showroom) {
      setStatus("connected");
      return;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus("connecting");

    try {
      const es = new EventSource("/api/sse/events");
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus("connected");
        reconnectAttempts.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastEvent(parsed);
          setEventCount((c) => c + 1);
        } catch {
          // Ignore parse errors (heartbeats, etc.)
        }
      };

      es.addEventListener("heartbeat", () => {
        // Keep-alive, no action needed
      });

      es.addEventListener("document", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastEvent({ type: "document", data: parsed, timestamp: new Date().toISOString() });
          setEventCount((c) => c + 1);
        } catch {}
      });

      es.addEventListener("alert", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastEvent({ type: "alert", data: parsed, timestamp: new Date().toISOString() });
          setEventCount((c) => c + 1);
        } catch {}
      });

      es.addEventListener("metric", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastEvent({ type: "metric", data: parsed, timestamp: new Date().toISOString() });
          setEventCount((c) => c + 1);
        } catch {}
      });

      es.onerror = () => {
        es.close();
        setStatus("error");

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setStatus("disconnected");
        }
      };
    } catch {
      setStatus("error");
    }
  }, [showroom]);

  const disconnect = useCallback(() => {
    if (showroom) {
      setStatus("connected");
      return;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setStatus("disconnected");
  }, [showroom]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    lastEvent,
    eventCount,
    connect,
    disconnect,
  };
}
