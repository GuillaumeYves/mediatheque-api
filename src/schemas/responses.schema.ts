import { z } from "zod";
import { RESERVATION_STATUSES } from "./reservation.schema.ts";

// Schémas des réponses : ils décrivent ce que l'API renvoie, pour la documentation OpenAPI.

const dateTime = z.iso.datetime();
const id = z.number().int().positive();

export const errorSchema = z
  .object({
    erreur: z.string(),
    details: z.array(z.object({ champ: z.string(), message: z.string() })).optional(),
  })
  .meta({ id: "Erreur" });

export const userSchema = z
  .object({ id, email: z.email(), role: z.enum(["membre", "bibliothecaire"]), creeLe: dateTime })
  .meta({ id: "Utilisateur" });

export const tokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number().int().meta({ description: "Durée de vie de l'access token, en secondes" }),
  })
  .meta({ id: "Jetons" });

export const sessionSchema = tokensSchema
  .extend({ utilisateur: z.object({ id, email: z.email(), role: z.enum(["membre", "bibliothecaire"]) }) })
  .meta({ id: "Session" });

const bookSummary = z.object({ id, titre: z.string(), auteur: z.string() });
const userSummary = z.object({ id, email: z.email() });

export const bookSchema = z
  .object({
    id,
    titre: z.string(),
    auteur: z.string(),
    annee: z.number().int(),
    disponible: z.boolean(),
    creeLe: dateTime,
    modifieLe: dateTime,
  })
  .meta({ id: "Ouvrage" });

const loanFields = {
  id,
  ouvrageId: id,
  emprunteurId: id,
  empruntLe: dateTime,
  retourPrevuLe: dateTime,
  rendu: z.boolean(),
  renduLe: dateTime.nullable(),
};

export const bookDetailSchema = bookSchema
  .extend({ emprunts: z.array(z.object(loanFields)).meta({ description: "Emprunts en cours visibles" }) })
  .meta({ id: "OuvrageDetail" });

export const loanSchema = z
  .object({ ...loanFields, ouvrage: bookSummary, emprunteur: userSummary })
  .meta({ id: "Emprunt" });

export const returnSchema = loanSchema
  .extend({
    empruntSuivant: loanSchema
      .nullable()
      .meta({ description: "Emprunt créé pour la plus ancienne réservation de l'ouvrage, s'il y en avait une" }),
  })
  .meta({ id: "Retour" });

export const reservationSchema = z
  .object({
    id,
    ouvrageId: id,
    membreId: id,
    statut: z.enum(RESERVATION_STATUSES),
    creeLe: dateTime,
    clotureLe: dateTime.nullable(),
    empruntId: id.nullable(),
    ouvrage: bookSummary,
    membre: userSummary,
  })
  .meta({ id: "Reservation" });

export const healthSchema = z.object({ statut: z.string(), base: z.string() }).meta({ id: "Sante" });

// Enveloppe commune des listes paginées.
export function pageOf(item: z.ZodType, name: string) {
  return z
    .object({
      donnees: z.array(item),
      page: z.number().int(),
      limite: z.number().int(),
      total: z.number().int(),
      pages: z.number().int(),
    })
    .meta({ id: name });
}
