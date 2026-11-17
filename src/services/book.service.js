import { conflict, notFound } from "../erreurs.js";
import { toPage, toSkipTake } from "./pagination.js";

// Règles métier du catalogue.
export function createBookService({ repositories, transaction }) {
  const { books } = repositories;

  return {
    async list({ page, limite, disponible }) {
      const where = disponible === undefined ? {} : { disponible };
      const result = await books.findPage({ where, ...toSkipTake({ page, limite }) });
      return toPage(result, { page, limite });
    },

    async getById(id) {
      const book = await books.findByIdWithActiveLoans(id);
      if (!book) throw notFound("Ouvrage introuvable");
      return book;
    },

    create: (data) => books.create(data),

    // Un identifiant inconnu lève P2025, traduit en 404.
    update: (id, changes) => books.update(id, changes),

    // Un ouvrage en cours d'emprunt ne peut pas être supprimé.
    // Un ouvrage avec un historique d'emprunts est protégé par la clé étrangère (P2003, 409).
    remove: (id) =>
      transaction(async ({ books: txBooks, loans }) => {
        if (!(await txBooks.exists(id))) throw notFound("Ouvrage introuvable");
        if ((await loans.countActiveForBook(id)) > 0) throw conflict("Ouvrage actuellement emprunté");
        await txBooks.delete(id);
      }),
  };
}
