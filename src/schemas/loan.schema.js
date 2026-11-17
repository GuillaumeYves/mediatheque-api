import { z } from "zod";
import { idSchema, isoDateSchema, paginationSchema, queryBooleanSchema } from "./common.schema.js";

const borrowerSchema = z.string().trim().min(2).max(80);

export const createLoanSchema = z
  .object({
    ouvrageId: idSchema,
    emprunteur: borrowerSchema,
    empruntLe: isoDateSchema.optional(),
    retourPrevuLe: isoDateSchema,
  })
  .refine((loan) => loan.retourPrevuLe > (loan.empruntLe ?? new Date()), {
    message: "La date de retour prévue doit suivre la date d'emprunt",
    path: ["retourPrevuLe"],
  });

// L'ouvrage et l'état rendu ne se modifient pas ici : retour par une route dédiée.
export const updateLoanSchema = z
  .object({
    emprunteur: borrowerSchema,
    retourPrevuLe: isoDateSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Au moins un champ à modifier");

export const listLoansQuerySchema = paginationSchema.extend({
  rendu: queryBooleanSchema.optional(),
  ouvrageId: idSchema.optional(),
});
