import type { AuthUser } from "../domain/types.ts";
import { conflict, notFound, prismaErrorCode } from "../erreurs.ts";
import type { DataAccess } from "../repositories/index.ts";
import type { CreateReservationInput, ListReservationsQuery } from "../schemas/reservation.schema.ts";
import { assertVisibleTo, ownerScope, resolveBeneficiary } from "./ownership.ts";
import { toPage, toSkipTake } from "./pagination.ts";

const reservationNotFound = () => notFound("Réservation introuvable");

// Règles métier des réservations : file d'attente sur les ouvrages indisponibles.
export function createReservationService({ repositories, transaction }: DataAccess) {
  const { reservations, users } = repositories;

  async function getById(id: number, actor: AuthUser) {
    const reservation = await reservations.findById(id);
    if (!reservation) throw reservationNotFound();
    assertVisibleTo(reservation.membreId, actor, reservationNotFound);
    return reservation;
  }

  return {
    getById,

    async list({ page, limite, statut, ouvrageId }: ListReservationsQuery, actor: AuthUser) {
      const result = await reservations.findPage({
        where: { statut, ouvrageId, membreId: ownerScope(actor) },
        ...toSkipTake({ page, limite }),
      });
      return toPage(result, { page, limite });
    },

    // Seul un ouvrage indisponible se réserve ; une seule réservation active par membre et par ouvrage.
    async create({ ouvrageId, membreId }: CreateReservationInput, actor: AuthUser) {
      const memberId = await resolveBeneficiary(membreId, actor, users);
      try {
        return await transaction(async ({ books, loans, reservations: txReservations }) => {
          const book = await books.findById(ouvrageId);
          if (!book) throw notFound("Ouvrage introuvable");
          if (book.disponible) throw conflict("Ouvrage disponible : empruntez-le directement");
          if (await loans.hasActiveLoan(memberId, ouvrageId)) throw conflict("Cet ouvrage est déjà emprunté par ce membre");
          return txReservations.create({ ouvrageId, membreId: memberId });
        });
      } catch (error) {
        // La contrainte d'unicité tranche aussi entre deux demandes simultanées.
        if (prismaErrorCode(error) === "P2002") throw conflict("Une réservation est déjà active pour cet ouvrage");
        throw error;
      }
    },

    // Annulation : la réservation sort de la file, l'historique est conservé.
    async cancel(id: number, actor: AuthUser) {
      await getById(id, actor);
      if (!(await reservations.closeIfActive(id, "annulee"))) throw conflict("Réservation déjà clôturée");
    },
  };
}

export type ReservationService = ReturnType<typeof createReservationService>;
