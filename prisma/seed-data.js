// Données de démonstration : ouvrages du domaine public, emprunteurs fictifs.
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days) => new Date(Date.now() + days * DAY_MS);

export const books = [
  { id: 1, titre: "Les Misérables", auteur: "Victor Hugo", annee: 1862 },
  { id: 2, titre: "Le Comte de Monte-Cristo", auteur: "Alexandre Dumas", annee: 1844 },
  { id: 3, titre: "Madame Bovary", auteur: "Gustave Flaubert", annee: 1857 },
  { id: 4, titre: "Germinal", auteur: "Émile Zola", annee: 1885 },
  { id: 5, titre: "Le Rouge et le Noir", auteur: "Stendhal", annee: 1830 },
  { id: 6, titre: "Vingt mille lieues sous les mers", auteur: "Jules Verne", annee: 1870 },
  { id: 7, titre: "Les Fleurs du mal", auteur: "Charles Baudelaire", annee: 1857 },
  { id: 8, titre: "Le Père Goriot", auteur: "Honoré de Balzac", annee: 1835 },
  { id: 9, titre: "Candide", auteur: "Voltaire", annee: 1759 },
  { id: 10, titre: "Bel-Ami", auteur: "Guy de Maupassant", annee: 1885 },
];

export const loans = [
  { id: 1, ouvrageId: 1, emprunteur: "Camille", empruntLe: daysFromNow(-10), retourPrevuLe: daysFromNow(4) },
  { id: 2, ouvrageId: 4, emprunteur: "Noé", empruntLe: daysFromNow(-3), retourPrevuLe: daysFromNow(11) },
  {
    id: 3,
    ouvrageId: 6,
    emprunteur: "Inès",
    empruntLe: daysFromNow(-30),
    retourPrevuLe: daysFromNow(-16),
    rendu: true,
    renduLe: daysFromNow(-18),
  },
];
