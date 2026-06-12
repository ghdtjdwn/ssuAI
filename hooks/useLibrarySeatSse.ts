import { useEffect } from "react";

export function useLibrarySeatSse(floor: number, onUpdate: () => void) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const eventSource = new EventSource(`/api/library/seats/events?floor=${floor}`, {
      withCredentials: true,
    });

    eventSource.addEventListener("seat-update", (event) => {
      console.log("Real-time seat update received:", event.data);
      onUpdate();
    });

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [floor, onUpdate]);
}

