import type { AuthUser } from "../domain/types.ts";

// Compte authentifié, posé par le middleware authenticate.
declare global {
  namespace Express {
    interface Request {
      utilisateur?: AuthUser;
    }
  }
}

export {};
