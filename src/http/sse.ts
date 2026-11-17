import type { Response } from "express";

export interface EventStream {
  send(data: unknown, event?: string): void;
  close(): void;
}

// Ouvre un flux Server-Sent Events : en-têtes envoyés tout de suite, puis un événement par écriture.
export function openEventStream(res: Response): EventStream {
  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Désactive la mise en tampon des proxys de type nginx.
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  return {
    send(data, event) {
      if (res.writableEnded) return;
      if (event) res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      if (!res.writableEnded) res.end();
    },
  };
}
