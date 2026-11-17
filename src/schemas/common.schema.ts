import { z } from "zod";

// Messages de validation en français pour tous les schémas.
z.config(z.locales.fr());

export const MAX_PAGE_SIZE = 50;
const MAX_INT = 2_147_483_647;

// Identifiant numérique, borné à la taille d'un entier PostgreSQL.
export const idSchema = z.coerce.number().int().positive().max(MAX_INT);
export const idParamsSchema = z.object({ id: idSchema.meta({ description: "Identifiant numérique" }) });

// Pagination commune : ?page= et ?limite=. Une limite trop grande est ramenée au plafond, comme le demande
// la consigne, au lieu d'être refusée ; la réponse indique la limite réellement appliquée.
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).meta({ description: "Numéro de page, à partir de 1" }),
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .overwrite((value) => Math.min(value, MAX_PAGE_SIZE))
    .default(10)
    .meta({ description: `Éléments par page, ramenés à ${MAX_PAGE_SIZE} au-delà` }),
});

// Date ISO 8601, jour seul ou date et heure, convertie en Date.
export const isoDateSchema = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })], { error: "Date ISO 8601 attendue" })
  .transform((value) => new Date(value))
  .meta({ description: "Date ISO 8601, par exemple 2030-01-15 ou 2030-01-15T10:00:00Z" });

// Booléen de query string : true, false, 1, 0, oui, non.
export const queryBooleanSchema = z.stringbool({ truthy: ["true", "1", "oui"], falsy: ["false", "0", "non"] });

export type PaginationInput = z.output<typeof paginationSchema>;
