import type { Db } from "../db/prisma.ts";
import type { Prisma } from "../generated/prisma/client.ts";

export interface PageQuery<W> {
  where: W;
  skip: number;
  take: number;
}

// Accès aux ouvrages. db est le client Prisma ou un client de transaction.
export function createBookRepository(db: Db) {
  return {
    async findPage({ where, skip, take }: PageQuery<Prisma.OuvrageWhereInput>) {
      const [items, total] = await Promise.all([
        db.ouvrage.findMany({ where, skip, take, orderBy: { id: "asc" } }),
        db.ouvrage.count({ where }),
      ]);
      return { items, total };
    },

    // Recherche insensible à la casse sur le titre ou l'auteur.
    search(term: string, limit: number) {
      const contains = { contains: term, mode: "insensitive" as const };
      return db.ouvrage.findMany({
        where: { OR: [{ titre: contains }, { auteur: contains }] },
        select: { id: true, titre: true, auteur: true, annee: true, disponible: true },
        orderBy: { titre: "asc" },
        take: limit,
      });
    },

    // Inclut les emprunts en cours, éventuellement limités à un emprunteur.
    findByIdWithActiveLoans(id: number, { borrowerId }: { borrowerId?: number } = {}) {
      const where: Prisma.EmpruntWhereInput = { rendu: false };
      if (borrowerId !== undefined) where.emprunteurId = borrowerId;
      return db.ouvrage.findUnique({
        where: { id },
        include: { emprunts: { where, orderBy: { empruntLe: "asc" } } },
      });
    },

    findById: (id: number) => db.ouvrage.findUnique({ where: { id } }),
    create: (data: Prisma.OuvrageCreateInput) => db.ouvrage.create({ data }),
    update: (id: number, data: Prisma.OuvrageUpdateInput) => db.ouvrage.update({ where: { id }, data }),
    delete: (id: number) => db.ouvrage.delete({ where: { id } }),
    exists: async (id: number) => (await db.ouvrage.count({ where: { id } })) > 0,

    // Passe l'ouvrage en indisponible seulement s'il est libre : renvoie false sinon.
    async reserveIfAvailable(id: number) {
      const { count } = await db.ouvrage.updateMany({
        where: { id, disponible: true },
        data: { disponible: false },
      });
      return count === 1;
    },

    markAvailable: (id: number) => db.ouvrage.update({ where: { id }, data: { disponible: true } }),
  };
}

export type BookRepository = ReturnType<typeof createBookRepository>;
