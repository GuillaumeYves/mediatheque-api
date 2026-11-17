import type { Role } from "../generated/prisma/enums.ts";

export type { Role };

// Identité portée par l'access token : ni e-mail, ni donnée sensible.
export interface AuthUser {
  id: number;
  role: Role;
}

export interface Pagination {
  page: number;
  limite: number;
}

export interface Page<T> {
  donnees: T[];
  page: number;
  limite: number;
  total: number;
  pages: number;
}
