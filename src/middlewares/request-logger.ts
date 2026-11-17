import type { RequestHandler } from "express";

// Une ligne par requête : méthode, chemin, statut et durée.
// "close" couvre aussi les connexions coupées par le client, comme un flux SSE interrompu.
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("close", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const suffix = res.writableFinished ? "" : " (interrompue)";
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)} ms${suffix}`);
  });
  next();
};
