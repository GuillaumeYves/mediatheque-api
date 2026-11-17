import type { Db } from "../db/prisma.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { PageQuery } from "./book.repository.ts";

// Relations jointes à chaque emprunt : résumé de l'ouvrage et compte de l'emprunteur.
const WITH_RELATIONS = {
  ouvrage: { select: { id: true, titre: true, auteur: true } },
  emprunteur: { select: { id: true, email: true } },
} satisfies Prisma.EmpruntInclude;

// Accès aux emprunts. db est le client Prisma ou un client de transaction.
export function createLoanRepository(db: Db) {
  return {
    async findPage({ where, skip, take }: PageQuery<Prisma.EmpruntWhereInput>) {
      const [items, total] = await Promise.all([
        db.emprunt.findMany({ where, skip, take, include: WITH_RELATIONS, orderBy: { id: "asc" } }),
        db.emprunt.count({ where }),
      ]);
      return { items, total };
    },

    findById: (id: number) => db.emprunt.findUnique({ where: { id }, include: WITH_RELATIONS }),
    create: (data: Prisma.EmpruntUncheckedCreateInput) => db.emprunt.create({ data, include: WITH_RELATIONS }),
    update: (id: number, data: Prisma.EmpruntUncheckedUpdateInput) =>
      db.emprunt.update({ where: { id }, data, include: WITH_RELATIONS }),
    delete: (id: number) => db.emprunt.delete({ where: { id } }),
    countActiveForBook: (ouvrageId: number) => db.emprunt.count({ where: { ouvrageId, rendu: false } }),

    hasActiveLoan: async (emprunteurId: number, ouvrageId: number) =>
      (await db.emprunt.count({ where: { emprunteurId, ouvrageId, rendu: false } })) > 0,

    // Marque l'emprunt rendu seulement s'il est en cours : renvoie false sinon.
    async closeIfActive(id: number, returnedAt: Date) {
      const { count } = await db.emprunt.updateMany({
        where: { id, rendu: false },
        data: { rendu: true, renduLe: returnedAt },
      });
      return count === 1;
    },
  };
}

export type LoanRepository = ReturnType<typeof createLoanRepository>;
