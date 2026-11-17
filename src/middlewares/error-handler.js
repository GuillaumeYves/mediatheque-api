import { toHttpError } from "../erreurs.js";

// Réponse 404 pour toute route non déclarée.
export function notFoundHandler(req, res) {
  res.status(404).json({ erreur: `Route inconnue : ${req.method} ${req.path}` });
}

// Gestionnaire central : réponse JSON, jamais de pile d'exécution côté client.
export function errorHandler(err, req, res, next) {
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
}
