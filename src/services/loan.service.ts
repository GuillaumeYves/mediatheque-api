import type { AuthUser } from "../domain/types.ts";
import { badRequest, conflict, notFound } from "../erreurs.ts";
import type { DataAccess, Repositories } from "../repositories/index.ts";
import type { CreateLoanInput, ListLoansQuery, UpdateLoanInput } from "../schemas/loan.schema.ts";
import { assertVisibleTo, ownerScope, resolveBeneficiary } from "./ownership.ts";
import { toPage, toSkipTake } from "./pagination.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const loanNotFound = () => notFound("Emprunt introuvable");

// Règles métier des emprunts : droits par propriétaire et changements d'état atomiques.
export function createLoanService({ repositories, transaction }: DataAccess, { loanDurationDays }: { loanDurationDays: number }) {
  const { loans, users } = repositories;

  // Libère un ouvrage rendu : la plus ancienne réservation devient un emprunt,
  // sinon l'ouvrage redevient disponible. À appeler dans une transaction.
  async function releaseBook({ books, loans: txLoans, reservations }: Repositories, ouvrageId: number) {
    const next = await reservations.findOldestActiveForBook(ouvrageId);
    if (!next) {
      await books.markAvailable(ouvrageId);
      return null;
    }
    const loan = await txLoans.create({
      ouvrageId,
      emprunteurId: next.membreId,
      retourPrevuLe: new Date(Date.now() + loanDurationDays * DAY_MS),
    });
    await reservations.closeIfActive(next.id, "honoree", loan.id);
    return loan;
  }

  async function getById(id: number, actor: AuthUser) {
    const loan = await loans.findById(id);
    if (!loan) throw loanNotFound();
    assertVisibleTo(loan.emprunteurId, actor, loanNotFound);
    return loan;
  }

  return {
    getById,

    // La liste d'un membre est toujours filtrée sur son propre compte.
    async list({ page, limite, rendu, ouvrageId }: ListLoansQuery, actor: AuthUser) {
      const result = await loans.findPage({
        where: { rendu, ouvrageId, emprunteurId: ownerScope(actor) },
        ...toSkipTake({ page, limite }),
      });
      return toPage(result, { page, limite });
    },

    // L'ouvrage devient indisponible dans la même transaction que la création de l'emprunt.
    async create({ emprunteurId, ...data }: CreateLoanInput, actor: AuthUser) {
      const borrowerId = await resolveBeneficiary(emprunteurId, actor, users);
      return transaction(async ({ books, loans: txLoans }) => {
        if (!(await books.reserveIfAvailable(data.ouvrageId))) {
          if (!(await books.exists(data.ouvrageId))) throw notFound("Ouvrage introuvable");
          throw conflict("Ouvrage déjà emprunté");
        }
        return txLoans.create({ ...data, emprunteurId: borrowerId });
      });
    },

    async update(id: number, changes: UpdateLoanInput, actor: AuthUser) {
      const current = await getById(id, actor);
      if (changes.retourPrevuLe <= current.empruntLe) {
        throw badRequest("Données invalides", [
          { champ: "body.retourPrevuLe", message: "La date de retour prévue doit suivre la date d'emprunt" },
        ]);
      }
      return loans.update(id, changes);
    },

    // Clôture l'emprunt et passe l'ouvrage au suivant de la file, dans une seule transaction.
    returnLoan: (id: number, actor: AuthUser) =>
      transaction(async (repos) => {
        const loan = await repos.loans.findById(id);
        if (!loan) throw loanNotFound();
        assertVisibleTo(loan.emprunteurId, actor, loanNotFound);
        if (!(await repos.loans.closeIfActive(id, new Date()))) throw conflict("Emprunt déjà rendu");

        const empruntSuivant = await releaseBook(repos, loan.ouvrageId);
        const closed = await repos.loans.findById(id);
        return { ...closed!, empruntSuivant };
      }),

    // Supprimer un emprunt en cours libère aussi l'ouvrage, file d'attente comprise.
    remove: (id: number) =>
      transaction(async (repos) => {
        const loan = await repos.loans.findById(id);
        if (!loan) throw loanNotFound();
        await repos.loans.delete(id);
        if (!loan.rendu) await releaseBook(repos, loan.ouvrageId);
      }),
  };
}

export type LoanService = ReturnType<typeof createLoanService>;
