import { z } from "zod";
import { paginationSchema, queryBooleanSchema } from "./common.schema.js";

const FIRST_PRINT_YEAR = 1450;

// L'année maximale est recalculée à chaque validation.
const yearSchema = z
  .number()
  .int()
  .min(FIRST_PRINT_YEAR)
  .refine((year) => year <= new Date().getFullYear(), "L'année ne peut pas dépasser l'année courante");

// La disponibilité n'est pas modifiable : elle découle des emprunts.
export const createBookSchema = z.object({
  titre: z.string().trim().min(1).max(150),
  auteur: z.string().trim().min(1).max(120),
  annee: yearSchema,
});

export const updateBookSchema = createBookSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Au moins un champ à modifier");

export const listBooksQuerySchema = paginationSchema.extend({
  disponible: queryBooleanSchema.optional(),
});
