import type { RequestHandler } from "express";
import type { UsageRepository } from "../repositories/usage.repository.ts";

// Début du jour courant en UTC : le quota repart à zéro chaque jour à minuit UTC.
function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Fabrique quotaIa(limiteJetonsParJour) : 429 dès que le compte a atteint sa limite du jour.
// À placer après l'authentification.
export function createQuotaIa(usage: UsageRepository) {
  return function quotaIa(limiteJetonsParJour: number): RequestHandler {
    return async (req, res, next) => {
      const consumed = await usage.totalSince(req.utilisateur!.id, startOfUtcDay());
      if (consumed >= limiteJetonsParJour) {
        res.status(429).json({ erreur: "Quota quotidien de l'assistant atteint, réessayez demain" });
        return;
      }
      next();
    };
  };
}
