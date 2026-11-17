import { errorSchema } from "../schemas/responses.schema.ts";
import type { ResponseSpec } from "./route.ts";

// Descriptions communes des réponses d'erreur, réutilisées par toutes les routes.
const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Données invalides : les champs fautifs sont listés dans details",
  401: "Jeton absent, invalide ou expiré",
  403: "Rôle insuffisant ou ressource d'un autre membre",
  404: "Ressource introuvable",
  409: "Conflit avec l'état actuel de la ressource",
  413: "Corps de requête trop volumineux",
  429: "Trop de requêtes, réessayez plus tard",
};

export function errors(...statuses: number[]): Record<number, ResponseSpec> {
  return Object.fromEntries(
    statuses.map((status) => [status, { description: ERROR_DESCRIPTIONS[status] ?? "Erreur", schema: errorSchema }]),
  );
}
