import { errors } from "../http/responses.ts";
import { created, defineRoute, noContent, ok, type RouteGroup } from "../http/route.ts";
import { idParamsSchema } from "../schemas/common.schema.ts";
import { createReservationSchema, listReservationsQuerySchema } from "../schemas/reservation.schema.ts";
import { pageOf, reservationSchema } from "../schemas/responses.schema.ts";
import type { ReservationService } from "../services/reservation.service.ts";

// /api/reservations : file d'attente sur les ouvrages indisponibles.
export function reservationRoutes({ reservationService }: { reservationService: ReservationService }): RouteGroup {
  return {
    prefix: "/api/reservations",
    tag: "Réservations",
    description: "Un membre réserve un ouvrage emprunté et le reçoit en emprunt à son retour.",
    routes: [
      defineRoute({
        method: "get",
        path: "/",
        summary: "Lister les réservations",
        description: "Un membre ne reçoit que ses propres réservations.",
        access: "authenticated",
        query: listReservationsQuerySchema,
        responses: {
          200: { description: "Page de réservations", schema: pageOf(reservationSchema, "PageReservations") },
          ...errors(400, 401),
        },
        handler: async ({ query, user }) => ok(await reservationService.list(query, user)),
      }),

      defineRoute({
        method: "get",
        path: "/:id",
        summary: "Détail d'une réservation",
        access: "authenticated",
        params: idParamsSchema,
        responses: { 200: { description: "Réservation", schema: reservationSchema }, ...errors(400, 401, 404) },
        handler: async ({ params, user }) => ok(await reservationService.getById(params.id, user)),
      }),

      defineRoute({
        method: "post",
        path: "/",
        summary: "Réserver un ouvrage indisponible",
        description:
          "409 si l'ouvrage est disponible, si le membre l'emprunte déjà, ou s'il a déjà une réservation active dessus.",
        access: "authenticated",
        body: createReservationSchema,
        responses: { 201: { description: "Réservation créée", schema: reservationSchema }, ...errors(400, 401, 404, 409) },
        handler: async ({ body, user }) => created(await reservationService.create(body, user)),
      }),

      defineRoute({
        method: "delete",
        path: "/:id",
        summary: "Annuler une réservation",
        description: "La réservation passe au statut annulee et sort de la file d'attente.",
        access: "authenticated",
        params: idParamsSchema,
        responses: { 204: { description: "Réservation annulée" }, ...errors(400, 401, 404, 409) },
        handler: async ({ params, user }) => {
          await reservationService.cancel(params.id, user);
          return noContent();
        },
      }),
    ],
  };
}
