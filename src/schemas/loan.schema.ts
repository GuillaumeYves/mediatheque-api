import { z } from "zod";
import { idSchema, isoDateSchema, paginationSchema, queryBooleanSchema } from "./common.schema.ts";

// emprunteurId n'est pris en compte que pour un bibliothécaire ; un membre emprunte pour lui-même.
export const createLoanSchema = z
  .object({
    ouvrageId: idSchema,
    emprunteurId: idSchema.optional().meta({ description: "Bibliothécaire uniquement : membre emprunteur" }),
    empruntLe: isoDateSchema.optional(),
    retourPrevuLe: isoDateSchema,
  })
  .refine((loan) => loan.retourPrevuLe > (loan.empruntLe ?? new Date()), {
    message: "La date de retour prévue doit suivre la date d'emprunt",
    path: ["retourPrevuLe"],
  })
  .meta({ id: "NouvelEmprunt" });

// Seule la date de retour prévue se modifie : ni l'ouvrage, ni le propriétaire, ni l'état rendu.
export const updateLoanSchema = z
  .object({
    retourPrevuLe: isoDateSchema,
  })
  .meta({ id: "ModificationEmprunt" });

export const listLoansQuerySchema = paginationSchema.extend({
  rendu: queryBooleanSchema.optional().meta({ description: "Filtre sur l'état rendu" }),
  ouvrageId: idSchema.optional().meta({ description: "Filtre sur un ouvrage" }),
});

export type CreateLoanInput = z.output<typeof createLoanSchema>;
export type UpdateLoanInput = z.output<typeof updateLoanSchema>;
export type ListLoansQuery = z.output<typeof listLoansQuerySchema>;
