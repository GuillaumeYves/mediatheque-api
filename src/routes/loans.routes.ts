import { ROLES } from "../domain/roles.ts";
import { errors } from "../http/responses.ts";
import { created, defineRoute, noContent, ok, type RouteGroup } from "../http/route.ts";
import { idParamsSchema } from "../schemas/common.schema.ts";
import { createLoanSchema, listLoansQuerySchema, updateLoanSchema } from "../schemas/loan.schema.ts";
import { loanSchema, pageOf, returnSchema } from "../schemas/responses.schema.ts";
import type { LoanService } from "../services/loan.service.ts";

// /api/emprunts : le contrôle de propriété est fait par le service.
export function loanRoutes({ loanService }: { loanService: LoanService }): RouteGroup {
  return {
    prefix: "/api/emprunts",
    tag: "Emprunts",
    description: "Un membre ne voit et ne gère que ses emprunts ; un bibliothécaire les gère tous.",
    routes: [
      defineRoute({
        method: "get",
        path: "/",
        summary: "Lister les emprunts",
        description: "Un membre ne reçoit que ses propres emprunts.",
        access: "authenticated",
        query: listLoansQuerySchema,
        responses: { 200: { description: "Page d'emprunts", schema: pageOf(loanSchema, "PageEmprunts") }, ...errors(400, 401) },
        handler: async ({ query, user }) => ok(await loanService.list(query, user)),
      }),

      defineRoute({
        method: "get",
        path: "/:id",
        summary: "Détail d'un emprunt",
        access: "authenticated",
        params: idParamsSchema,
        responses: { 200: { description: "Emprunt", schema: loanSchema }, ...errors(400, 401, 404) },
        handler: async ({ params, user }) => ok(await loanService.getById(params.id, user)),
      }),

      defineRoute({
        method: "post",
        path: "/",
        summary: "Emprunter un ouvrage",
        description: "L'ouvrage devient indisponible dans la même transaction. Un membre emprunte pour lui-même.",
        access: "authenticated",
        body: createLoanSchema,
        responses: { 201: { description: "Emprunt créé", schema: loanSchema }, ...errors(400, 401, 404, 409) },
        handler: async ({ body, user }) => created(await loanService.create(body, user)),
      }),

      defineRoute({
        method: "patch",
        path: "/:id",
        summary: "Prolonger un emprunt",
        description: "Seule la date de retour prévue se modifie : ni l'ouvrage, ni le propriétaire.",
        access: "authenticated",
        params: idParamsSchema,
        body: updateLoanSchema,
        responses: { 200: { description: "Emprunt modifié", schema: loanSchema }, ...errors(400, 401, 404) },
        handler: async ({ params, body, user }) => ok(await loanService.update(params.id, body, user)),
      }),

      defineRoute({
        method: "post",
        path: "/:id/retour",
        summary: "Rendre un ouvrage",
        description:
          "Clôture l'emprunt. Si l'ouvrage est réservé, la plus ancienne réservation devient un emprunt dans la même transaction ; sinon l'ouvrage redevient disponible.",
        access: "authenticated",
        params: idParamsSchema,
        responses: { 200: { description: "Emprunt clôturé", schema: returnSchema }, ...errors(400, 401, 404, 409) },
        handler: async ({ params, user }) => ok(await loanService.returnLoan(params.id, user)),
      }),

      defineRoute({
        method: "delete",
        path: "/:id",
        summary: "Supprimer un emprunt",
        access: [ROLES.LIBRARIAN],
        params: idParamsSchema,
        responses: { 204: { description: "Emprunt supprimé" }, ...errors(400, 401, 403, 404) },
        handler: async ({ params }) => {
          await loanService.remove(params.id);
          return noContent();
        },
      }),
    ],
  };
}
