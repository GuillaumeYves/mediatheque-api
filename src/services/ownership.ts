import { isLibrarian } from "../domain/roles.ts";
import type { AuthUser } from "../domain/types.ts";
import { notFound } from "../erreurs.ts";
import type { UserRepository } from "../repositories/user.repository.ts";

// Un bibliothécaire voit tout ; un membre seulement ce qui lui appartient.
// La ressource d'un autre membre lève la même erreur qu'une ressource absente (404) :
// la réponse ne révèle pas qu'un identifiant existe.
export function assertVisibleTo(ownerId: number, actor: AuthUser, notFoundError: () => Error): void {
  if (!isLibrarian(actor) && ownerId !== actor.id) throw notFoundError();
}

// Filtre de liste : un membre ne voit que ses propres lignes.
export function ownerScope(actor: AuthUser): number | undefined {
  return isLibrarian(actor) ? undefined : actor.id;
}

// Compte bénéficiaire : soi-même, ou le membre désigné par un bibliothécaire.
export async function resolveBeneficiary(
  requestedId: number | undefined,
  actor: AuthUser,
  users: UserRepository,
): Promise<number> {
  if (!isLibrarian(actor) || requestedId === undefined) return actor.id;
  if (!(await users.exists(requestedId))) throw notFound("Membre introuvable");
  return requestedId;
}
