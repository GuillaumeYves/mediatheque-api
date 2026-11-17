export interface FieldError {
  champ: string;
  message: string;
}

// Erreur applicative porteuse d'un statut HTTP.
export class HttpError extends Error {
  readonly status: number;
  readonly details: FieldError[] | undefined;

  constructor(status: number, message: string, details?: FieldError[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: FieldError[]) => new HttpError(400, message, details);
export const unauthorized = (message = "Authentification requise") => new HttpError(401, message);
export const forbidden = (message = "Accès refusé") => new HttpError(403, message);
export const notFound = (message = "Ressource introuvable") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

interface KnownError {
  status: number;
  message: string;
}

// Codes Prisma traduits en réponses HTTP lisibles.
const PRISMA_ERRORS: Record<string, KnownError> = {
  P2025: { status: 404, message: "Ressource introuvable" },
  P2003: { status: 409, message: "Opération impossible : la ressource est liée à d'autres données" },
  P2002: { status: 409, message: "Cette valeur existe déjà" },
};

// Erreurs levées par express.json().
const BODY_PARSER_ERRORS: Record<string, KnownError> = {
  "entity.parse.failed": { status: 400, message: "Corps JSON invalide" },
  "entity.too.large": { status: 413, message: "Corps de requête trop volumineux" },
};

function readString(error: unknown, key: "code" | "type"): string | undefined {
  if (typeof error !== "object" || error === null || !(key in error)) return undefined;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

// Code d'erreur Prisma, utile aux services qui traduisent un cas précis.
export const prismaErrorCode = (error: unknown) => readString(error, "code");

// Toute erreur de la bibliothèque jose (codes ERR_JWT_*, ERR_JWS_*) signale un jeton invalide.
const isTokenError = (error: unknown) => /^ERR_JW[STEK]/.test(readString(error, "code") ?? "");

// Convertit n'importe quelle erreur en HttpError, ou null si elle est inattendue.
export function toHttpError(error: unknown): HttpError | null {
  if (error instanceof HttpError) return error;
  if (isTokenError(error)) return unauthorized("Jeton invalide ou expiré");

  const code = readString(error, "code");
  const type = readString(error, "type");
  const known = (code && PRISMA_ERRORS[code]) || (type && BODY_PARSER_ERRORS[type]);
  return known ? new HttpError(known.status, known.message) : null;
}
