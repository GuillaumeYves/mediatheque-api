import type { ErrorRequestHandler, RequestHandler } from "express";
import { toHttpError } from "../erreurs.ts";

// Réponse 404 pour toute route non déclarée.
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ erreur: `Route inconnue : ${req.method} ${req.path}` });
};

// Gestionnaire central : réponse JSON, jamais de pile d'exécution côté client.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const httpError = toHttpError(err);
  if (httpError) {
    res.status(httpError.status).json({ erreur: httpError.message, details: httpError.details });
    return;
  }

  console.error(err);
  res.status(500).json({ erreur: "Erreur interne du serveur" });
};
