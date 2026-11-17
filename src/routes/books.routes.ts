import { ROLES } from "../domain/roles.ts";
import { errors } from "../http/responses.ts";
import { created, defineRoute, noContent, ok, type RouteGroup } from "../http/route.ts";
import { createBookSchema, listBooksQuerySchema, updateBookSchema } from "../schemas/book.schema.ts";
import { idParamsSchema } from "../schemas/common.schema.ts";
import { bookDetailSchema, bookSchema, pageOf } from "../schemas/responses.schema.ts";
import type { BookService } from "../services/book.service.ts";

const LIBRARIAN = [ROLES.LIBRARIAN] as const;

// /api/ouvrages : lecture pour tout compte, écriture pour les bibliothécaires.
export function bookRoutes({ bookService }: { bookService: BookService }): RouteGroup {
  return {
    prefix: "/api/ouvrages",
    tag: "Ouvrages",
    description: "Catalogue de la médiathèque.",
    routes: [
      defineRoute({
        method: "get",
        path: "/",
        summary: "Lister les ouvrages",
        access: "authenticated",
        query: listBooksQuerySchema,
        responses: { 200: { description: "Page d'ouvrages", schema: pageOf(bookSchema, "PageOuvrages") }, ...errors(400, 401) },
        handler: async ({ query }) => ok(await bookService.list(query)),
      }),

      defineRoute({
        method: "get",
        path: "/:id",
        summary: "Détail d'un ouvrage",
        description: "Inclut les emprunts en cours : tous pour un bibliothécaire, les siens pour un membre.",
        access: "authenticated",
        params: idParamsSchema,
        responses: { 200: { description: "Ouvrage", schema: bookDetailSchema }, ...errors(400, 401, 404) },
        handler: async ({ params, user }) => ok(await bookService.getById(params.id, user)),
      }),

      defineRoute({
        method: "post",
        path: "/",
        summary: "Ajouter un ouvrage",
        access: LIBRARIAN,
        body: createBookSchema,
        responses: { 201: { description: "Ouvrage créé", schema: bookSchema }, ...errors(400, 401, 403) },
        handler: async ({ body }) => created(await bookService.create(body)),
      }),

      defineRoute({
        method: "patch",
        path: "/:id",
        summary: "Modifier un ouvrage",
        description: "La disponibilité ne se modifie pas : elle découle des emprunts.",
        access: LIBRARIAN,
        params: idParamsSchema,
        body: updateBookSchema,
        responses: { 200: { description: "Ouvrage modifié", schema: bookSchema }, ...errors(400, 401, 403, 404) },
        handler: async ({ params, body }) => ok(await bookService.update(params.id, body)),
      }),

      defineRoute({
        method: "delete",
        path: "/:id",
        summary: "Supprimer un ouvrage",
        description: "409 si l'ouvrage est emprunté ou s'il a un historique d'emprunts ou de réservations.",
        access: LIBRARIAN,
        params: idParamsSchema,
        responses: { 204: { description: "Ouvrage supprimé" }, ...errors(400, 401, 403, 404, 409) },
        handler: async ({ params }) => {
          await bookService.remove(params.id);
          return noContent();
        },
      }),
    ],
  };
}
