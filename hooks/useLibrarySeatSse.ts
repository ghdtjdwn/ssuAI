import { useEffect, useRef } from "react";

export function useLibrarySeatSse(floor: number, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const eventSource = new EventSource(`/api/library/seats/events?floor=${floor}`, {
      withCredentials: true,
    });

    eventSource.addEventListener("seat-update", (event) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Real-time seat update received:", event.data);
      }
      onUpdateRef.current();
    });

    eventSource.onerror = (err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("SSE connection error:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [floor]);
}

