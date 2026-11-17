import type { Db } from "../db/prisma.ts";
import type { Prisma } from "../generated/prisma/client.ts";

// Champs exposables d'un compte : jamais l'empreinte du mot de passe.
export const PUBLIC_USER = { id: true, email: true, role: true, creeLe: true } satisfies Prisma.UtilisateurSelect;

// Accès aux comptes.
export function createUserRepository(db: Db) {
  return {
    create: (data: Prisma.UtilisateurCreateInput) => db.utilisateur.create({ data, select: PUBLIC_USER }),
    findById: (id: number) => db.utilisateur.findUnique({ where: { id }, select: PUBLIC_USER }),
    exists: async (id: number) => (await db.utilisateur.count({ where: { id } })) > 0,

    // Seul accès à l'empreinte, réservé à la vérification du mot de passe.
    findCredentialsByEmail: (email: string) => db.utilisateur.findUnique({ where: { email } }),
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
