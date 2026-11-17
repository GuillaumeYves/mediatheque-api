import { z } from "zod";
import { paginationSchema, queryBooleanSchema } from "./common.schema.ts";

const FIRST_PRINT_YEAR = 1450;

// L'année maximale est recalculée à chaque validation.
const yearSchema = z
  .number()
  .int()
  .min(FIRST_PRINT_YEAR)
  .refine((year) => year <= new Date().getFullYear(), "L'année ne peut pas dépasser l'année courante");

// La disponibilité n'est pas modifiable : elle découle des emprunts.
export const createBookSchema = z
  .object({
    titre: z.string().trim().min(1).max(150),
    auteur: z.string().trim().min(1).max(120),
    annee: yearSchema,
  })
  .meta({ id: "NouvelOuvrage" });

export const updateBookSchema = createBookSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Au moins un champ à modifier")
  .meta({ id: "ModificationOuvrage" });

export const listBooksQuerySchema = paginationSchema.extend({
  disponible: queryBooleanSchema.optional().meta({ description: "Filtre sur la disponibilité" }),
});

export type CreateBookInput = z.output<typeof createBookSchema>;
export type UpdateBookInput = z.output<typeof updateBookSchema>;
export type ListBooksQuery = z.output<typeof listBooksQuerySchema>;
