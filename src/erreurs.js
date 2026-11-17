// Erreur applicative porteuse d'un statut HTTP.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = "Ressource introuvable") => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

// Codes Prisma traduits en réponses HTTP lisibles.
const PRISMA_ERRORS = {
  P2025: { status: 404, message: "Ressource introuvable" },
  P2003: { status: 409, message: "Opération impossible : la ressource est liée à d'autres données" },
  P2002: { status: 409, message: "Cette valeur existe déjà" },
};

// Erreurs levées par express.json().
const BODY_PARSER_ERRORS = {
  "entity.parse.failed": { status: 400, message: "Corps JSON invalide" },
  "entity.too.large": { status: 413, message: "Corps de requête trop volumineux" },
};

// Convertit n'importe quelle erreur en HttpError, ou null si elle est inattendue.
export function toHttpError(error) {
  if (error instanceof HttpError) return error;

  const known = PRISMA_ERRORS[error?.code] ?? BODY_PARSER_ERRORS[error?.type];
  return known ? new HttpError(known.status, known.message) : null;
}
