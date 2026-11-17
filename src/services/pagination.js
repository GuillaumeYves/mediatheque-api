// Convertit page et limite en décalage pour la base.
export function toSkipTake({ page, limite }) {
  return { skip: (page - 1) * limite, take: limite };
}

// Forme commune des réponses paginées.
export function toPage({ items, total }, { page, limite }) {
  return { donnees: items, page, limite, total, pages: Math.ceil(total / limite) };
}
