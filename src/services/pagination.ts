import type { Page, Pagination } from "../domain/types.ts";

// Convertit page et limite en décalage pour la base.
export function toSkipTake({ page, limite }: Pagination) {
  return { skip: (page - 1) * limite, take: limite };
}

// Forme commune des réponses paginées.
export function toPage<T>({ items, total }: { items: T[]; total: number }, { page, limite }: Pagination): Page<T> {
  return { donnees: items, page, limite, total, pages: Math.ceil(total / limite) };
}
