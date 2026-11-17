import type { Db } from "../db/prisma.ts";

// Consommation de l'assistant, table consommation_ia.
export function createUsageRepository(db: Db) {
  return {
    record: (data: { utilisateurId: number; jetonsEntree: number; jetonsSortie: number }) =>
      db.consommationIa.create({ data }),

    // Total des jetons d'entrée et de sortie depuis une date.
    async totalSince(utilisateurId: number, since: Date): Promise<number> {
      const { _sum } = await db.consommationIa.aggregate({
        where: { utilisateurId, creeLe: { gte: since } },
        _sum: { jetonsEntree: true, jetonsSortie: true },
      });
      return (_sum.jetonsEntree ?? 0) + (_sum.jetonsSortie ?? 0);
    },
  };
}

export type UsageRepository = ReturnType<typeof createUsageRepository>;
