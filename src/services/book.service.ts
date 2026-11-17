import type { AuthUser } from "../domain/types.ts";
import { conflict, notFound } from "../erreurs.ts";
import type { DataAccess } from "../repositories/index.ts";
import type { CreateBookInput, ListBooksQuery, UpdateBookInput } from "../schemas/book.schema.ts";
import { ownerScope } from "./ownership.ts";
import { toPage, toSkipTake } from "./pagination.ts";

const SEARCH_LIMIT = 10;

// Règles métier du catalogue.
export function createBookService({ repositories, transaction }: DataAccess) {
  const { books } = repositories;

  return {
    async list({ page, limite, disponible }: ListBooksQuery) {
      const where = disponible === undefined ? {} : { disponible };
      const result = await books.findPage({ where, ...toSkipTake({ page, limite }) });
      return toPage(result, { page, limite });
    },

    search: (term: string) => books.search(term, SEARCH_LIMIT),

    // Un membre ne voit que ses propres emprunts en cours sur l'ouvrage.
    async getById(id: number, actor: AuthUser) {
      const borrowerId = ownerScope(actor);
      const book = await books.findByIdWithActiveLoans(id, borrowerId === undefined ? {} : { borrowerId });
      if (!book) throw notFound("Ouvrage introuvable");
      return book;
    },

    create: (data: CreateBookInput) => books.create(data),

    // Un identifiant inconnu lève P2025, traduit en 404.
    update: (id: number, changes: UpdateBookInput) => books.update(id, changes),

    // Un ouvrage en cours d'emprunt ne peut pas être supprimé.
    // Un ouvrage avec un historique est protégé par la clé étrangère (P2003, 409).
    remove: (id: number) =>
      transaction(async ({ books: txBooks, loans }) => {
        if (!(await txBooks.exists(id))) throw notFound("Ouvrage introuvable");
        if ((await loans.countActiveForBook(id)) > 0) throw conflict("Ouvrage actuellement emprunté");
        await txBooks.delete(id);
      }),
  };
}

export type BookService = ReturnType<typeof createBookService>;
