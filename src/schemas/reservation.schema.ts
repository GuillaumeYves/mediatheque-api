import { z } from "zod";
import { idSchema, paginationSchema } from "./common.schema.ts";

export const RESERVATION_STATUSES = ["active", "annulee", "honoree"] as const;

// membreId n'est pris en compte que pour un bibliothécaire ; un membre réserve pour lui-même.
export const createReservationSchema = z
  .object({
    ouvrageId: idSchema,
    membreId: idSchema.optional().meta({ description: "Bibliothécaire uniquement : membre bénéficiaire" }),
  })
  .meta({ id: "NouvelleReservation" });

export const listReservationsQuerySchema = paginationSchema.extend({
  statut: z.enum(RESERVATION_STATUSES).optional().meta({ description: "Filtre sur le statut" }),
  ouvrageId: idSchema.optional().meta({ description: "Filtre sur un ouvrage" }),
});

export type CreateReservationInput = z.output<typeof createReservationSchema>;
export type ListReservationsQuery = z.output<typeof listReservationsQuerySchema>;
