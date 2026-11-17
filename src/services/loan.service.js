import { badRequest, conflict, notFound } from "../erreurs.js";
import { toPage, toSkipTake } from "./pagination.js";

const loanNotFound = () => notFound("Emprunt introuvable");

// Règles métier des emprunts : chaque changement d'état est atomique.
export function createLoanService({ repositories, transaction }) {
  const { loans } = repositories;

  async function getById(id) {
    const loan = await loans.findById(id);
    if (!loan) throw loanNotFound();
    return loan;
  }

  return {
    getById,

    async list({ page, limite, rendu, ouvrageId }) {
      const where = {};
      if (rendu !== undefined) where.rendu = rendu;
      if (ouvrageId !== undefined) where.ouvrageId = ouvrageId;
      const result = await loans.findPage({ where, ...toSkipTake({ page, limite }) });
      return toPage(result, { page, limite });
    },

    // L'ouvrage devient indisponible dans la même transaction que la création de l'emprunt.
    create: (data) =>
      transaction(async ({ books, loans: txLoans }) => {
        if (!(await books.reserveIfAvailable(data.ouvrageId))) {
          if (!(await books.exists(data.ouvrageId))) throw notFound("Ouvrage introuvable");
          throw conflict("Ouvrage déjà emprunté");
        }
        return txLoans.create(data);
      }),

    async update(id, changes) {
      if (changes.retourPrevuLe) {
        const current = await getById(id);
        if (changes.retourPrevuLe <= current.empruntLe) {
          throw badRequest("Données invalides", [
            { champ: "body.retourPrevuLe", message: "La date de retour prévue doit suivre la date d'emprunt" },
          ]);
        }
      }
      return loans.update(id, changes);
    },

    // Clôture l'emprunt et libère l'ouvrage ensemble.
    returnLoan: (id) =>
      transaction(async ({ books, loans: txLoans }) => {
        const loan = await txLoans.findById(id);
        if (!loan) throw loanNotFound();
        if (!(await txLoans.closeIfActive(id, new Date()))) throw conflict("Emprunt déjà rendu");
        await books.markAvailable(loan.ouvrageId);
        return txLoans.findById(id);
      }),

    // Supprimer un emprunt en cours libère aussi l'ouvrage.
    remove: (id) =>
      transaction(async ({ books, loans: txLoans }) => {
        const loan = await txLoans.findById(id);
        if (!loan) throw loanNotFound();
        await txLoans.delete(id);
        if (!loan.rendu) await books.markAvailable(loan.ouvrageId);
      }),
  };
}
