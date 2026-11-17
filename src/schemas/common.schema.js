import { z } from "zod";

// Messages de validation en français pour tous les schémas.
z.config(z.locales.fr());

export const MAX_PAGE_SIZE = 50;
const MAX_INT = 2_147_483_647;

// Identifiant numérique de l'URL, borné à la taille d'un entier PostgreSQL.
export const idSchema = z.coerce.number().int().positive().max(MAX_INT);
export const idParamsSchema = z.object({ id: idSchema });

// Pagination commune : ?page= et ?limite=, limite plafonnée.
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
});

// Date ISO 8601, jour seul ou date et heure, convertie en Date.
export const isoDateSchema = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })], { error: "Date ISO 8601 attendue" })
  .transform((value) => new Date(value));

// Booléen de query string : true, false, 1, 0, oui, non.
export const queryBooleanSchema = z.stringbool({ truthy: ["true", "1", "oui"], falsy: ["false", "0", "non"] });
