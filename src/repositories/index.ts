import type { Db, PrismaClient } from "../db/prisma.ts";
import { createBookRepository } from "./book.repository.ts";
import { createLoanRepository } from "./loan.repository.ts";
import { createRefreshTokenRepository } from "./refresh-token.repository.ts";
import { createReservationRepository } from "./reservation.repository.ts";
import { createUsageRepository } from "./usage.repository.ts";
import { createUserRepository } from "./user.repository.ts";

// Regroupe les dépôts autour d'un même client (Prisma ou transaction).
export function createRepositories(db: Db) {
  return {
    books: createBookRepository(db),
    loans: createLoanRepository(db),
    reservations: createReservationRepository(db),
    users: createUserRepository(db),
    refreshTokens: createRefreshTokenRepository(db),
    usage: createUsageRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export interface DataAccess {
  repositories: Repositories;
  // Tout ce que fait fn est validé ensemble ou annulé ensemble.
  transaction<T>(fn: (repositories: Repositories) => Promise<T>): Promise<T>;
}

// Point d'accès unique aux dépôts, avec exécution transactionnelle.
export function createDataAccess(prisma: PrismaClient): DataAccess {
  return {
    repositories: createRepositories(prisma),
    transaction: (fn) => prisma.$transaction((tx) => fn(createRepositories(tx))),
  };
}
