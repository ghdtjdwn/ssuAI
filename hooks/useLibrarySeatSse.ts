import { useEffect, useRef } from "react";

/**
 * Subscribe to real-time seat updates for one floor.
 *
 * The EventSource is SHARED across the whole app, one per floor, and
 * ref-counted: the first subscriber opens the stream, the last one closes it.
 * Several default-on home surfaces read seat data at once (briefing hero,
 * priority cards, seats widget), so without sharing, the home page alone would
 * open 3 components × 3 floors = 9 EventSource connections to only 3 distinct
 * endpoints — enough to exhaust the browser's ~6-connections-per-host budget
 * under HTTP/1.1 and starve other requests. Sharing collapses that to one
 * connection per floor regardless of how many components subscribe.
 */

type Listener = () => void;

interface FloorChannel {
  source: EventSource;
  listeners: Set<Listener>;
}

const channels = new Map<number, FloorChannel>();

function subscribe(floor: number, listener: Listener): () => void {
  let channel = channels.get(floor);
  if (!channel) {
    const source = new EventSource(`/api/library/seats/events?floor=${floor}`, {
      withCredentials: true,
    });
    const created: FloorChannel = { source, listeners: new Set() };
    source.addEventListener("seat-update", (event) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Real-time seat update received:", event.data);
      }
      created.listeners.forEach((l) => l());
    });
    source.onerror = (err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("SSE connection error:", err);
      }
    };
    channels.set(floor, created);
    channel = created;
  }
  channel.listeners.add(listener);

  return () => {
    const current = channels.get(floor);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      current.source.close();
      channels.delete(floor);
    }
  };
}

export function useLibrarySeatSse(floor: number, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }
    return subscribe(floor, () => onUpdateRef.current());
  }, [floor]);
}
