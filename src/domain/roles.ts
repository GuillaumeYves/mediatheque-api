import type { AuthUser, Role } from "./types.ts";

// Rôles de l'API, identiques à l'énumération Role du schéma Prisma.
export const ROLES = {
  MEMBER: "membre",
  LIBRARIAN: "bibliothecaire",
} as const satisfies Record<string, Role>;

export const isLibrarian = (user: AuthUser | undefined): boolean => user?.role === ROLES.LIBRARIAN;
