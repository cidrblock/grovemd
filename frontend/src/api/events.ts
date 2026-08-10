import type { FsEvent } from "../types";

export function subscribeFsEvents(onEvent: (event: FsEvent) => void): () => void {
  const source = new EventSource("/api/events");

  source.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as FsEvent;
      if (data?.event && data?.path) onEvent(data);
    } catch {
      /* ignore malformed */
    }
  };

  return () => source.close();
}
