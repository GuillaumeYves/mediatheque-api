// Résumé de l'ouvrage joint à chaque emprunt.
const WITH_BOOK = { ouvrage: { select: { id: true, titre: true, auteur: true } } };

// Accès aux emprunts. db est le client Prisma ou un client de transaction.
export function createLoanRepository(db) {
  return {
    async findPage({ where, skip, take }) {
      const [items, total] = await Promise.all([
        db.emprunt.findMany({ where, skip, take, include: WITH_BOOK, orderBy: { id: "asc" } }),
        db.emprunt.count({ where }),
      ]);
      return { items, total };
    },

    findById: (id) => db.emprunt.findUnique({ where: { id }, include: WITH_BOOK }),
    create: (data) => db.emprunt.create({ data, include: WITH_BOOK }),
    update: (id, data) => db.emprunt.update({ where: { id }, data, include: WITH_BOOK }),
    delete: (id) => db.emprunt.delete({ where: { id } }),
    countActiveForBook: (ouvrageId) => db.emprunt.count({ where: { ouvrageId, rendu: false } }),

    // Marque l'emprunt rendu seulement s'il est en cours : renvoie false sinon.
    async closeIfActive(id, returnedAt) {
      const { count } = await db.emprunt.updateMany({
        where: { id, rendu: false },
        data: { rendu: true, renduLe: returnedAt },
      });
      return count === 1;
    },
  };
}
