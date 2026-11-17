import type { Db } from "../db/prisma.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { StatutReservation } from "../generated/prisma/enums.ts";
import type { PageQuery } from "./book.repository.ts";

const WITH_RELATIONS = {
  ouvrage: { select: { id: true, titre: true, auteur: true } },
  membre: { select: { id: true, email: true } },
} satisfies Prisma.ReservationInclude;

// Accès aux réservations. db est le client Prisma ou un client de transaction.
export function createReservationRepository(db: Db) {
  return {
    async findPage({ where, skip, take }: PageQuery<Prisma.ReservationWhereInput>) {
      const [items, total] = await Promise.all([
        db.reservation.findMany({ where, skip, take, include: WITH_RELATIONS, orderBy: { id: "asc" } }),
        db.reservation.count({ where }),
      ]);
      return { items, total };
    },

    findById: (id: number) => db.reservation.findUnique({ where: { id }, include: WITH_RELATIONS }),

    create: (data: { ouvrageId: number; membreId: number }) =>
      db.reservation.create({ data, include: WITH_RELATIONS }),

    // File d'attente : la plus ancienne réservation active de l'ouvrage.
    findOldestActiveForBook: (ouvrageId: number) =>
      db.reservation.findFirst({
        where: { ouvrageId, statut: "active" },
        orderBy: [{ creeLe: "asc" }, { id: "asc" }],
      }),

    // Clôture une réservation encore active : renvoie false si elle ne l'était plus.
    async closeIfActive(id: number, statut: Exclude<StatutReservation, "active">, empruntId?: number) {
      const { count } = await db.reservation.updateMany({
        where: { id, statut: "active" },
        data: { statut, enCours: null, clotureLe: new Date(), empruntId: empruntId ?? null },
      });
      return count === 1;
    },
  };
}

export type ReservationRepository = ReturnType<typeof createReservationRepository>;
