// Accès aux ouvrages. db est le client Prisma ou un client de transaction.
export function createBookRepository(db) {
  return {
    async findPage({ where, skip, take }) {
      const [items, total] = await Promise.all([
        db.ouvrage.findMany({ where, skip, take, orderBy: { id: "asc" } }),
        db.ouvrage.count({ where }),
      ]);
      return { items, total };
    },

    // Inclut les emprunts en cours, du plus ancien au plus récent.
    findByIdWithActiveLoans(id) {
      return db.ouvrage.findUnique({
        where: { id },
        include: { emprunts: { where: { rendu: false }, orderBy: { empruntLe: "asc" } } },
      });
    },

    create: (data) => db.ouvrage.create({ data }),
    update: (id, data) => db.ouvrage.update({ where: { id }, data }),
    delete: (id) => db.ouvrage.delete({ where: { id } }),
    exists: async (id) => (await db.ouvrage.count({ where: { id } })) > 0,

    // Passe l'ouvrage en indisponible seulement s'il est libre : renvoie false sinon.
    async reserveIfAvailable(id) {
      const { count } = await db.ouvrage.updateMany({
        where: { id, disponible: true },
        data: { disponible: false },
      });
      return count === 1;
    },

    markAvailable: (id) => db.ouvrage.update({ where: { id }, data: { disponible: true } }),
  };
}
