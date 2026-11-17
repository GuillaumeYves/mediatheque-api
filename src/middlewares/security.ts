import cors from "cors";
import type { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { forbidden } from "../erreurs.ts";

const TOO_MANY_REQUESTS = { erreur: "Trop de requêtes, réessayez plus tard" };

// En-têtes de sécurité HTTP.
export const securityHeaders = (): RequestHandler => helmet();

// CORS limité aux origines déclarées. Sans en-tête Origin (mobile, curl), la requête passe.
export function corsPolicy(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return cors({
    origin: (origin, callback) => {
      if (!origin || allowed.has(origin)) callback(null, true);
      else callback(forbidden("Origine non autorisée"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  });
}

interface LimiterOptions {
  max: number;
  windowMs: number;
  // Par défaut, la clé est l'adresse IP.
  keyGenerator?: (req: Request) => string;
}

// Limiteur de débit : en-têtes RateLimit-* standard et réponse JSON en 429.
export function rateLimiter({ max, windowMs, keyGenerator }: LimiterOptions): RequestHandler {
  return rateLimit({
    limit: max,
    windowMs,
    standardHeaders: "draft-6",
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res) => {
      res.status(429).json(TOO_MANY_REQUESTS);
    },
  });
}

// Clé par compte connecté : un utilisateur ne consomme pas le quota d'un autre derrière la même IP.
export const perUserKey = (req: Request): string =>
  req.utilisateur ? `utilisateur:${req.utilisateur.id}` : ipKeyGenerator(req.ip ?? "");
