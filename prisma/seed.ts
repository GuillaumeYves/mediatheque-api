// Seeder rejouable : upsert par clé stable, aucun doublon après plusieurs exécutions.
import "dotenv/config";
import { createPrismaClient } from "../src/db/prisma.ts";
import { createPasswordHasher } from "../src/security/password.ts";
import { books, loans, reservations, users } from "./seed-data.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Variable d'environnement manquante : DATABASE_URL");

const prisma = createPrismaClient(databaseUrl);
const passwordHasher = createPasswordHasher({ cost: 12 });

// Les identifiants fixes n'avancent pas la séquence : on la recale sur le maximum.
async function syncSequence(table: "Ouvrage" | "Emprunt" | "Reservation") {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
  );
}

// Comptes indexés par e-mail ; un compte existant garde son mot de passe.
async function seedUsers() {
  const idsByEmail = new Map<string, number>();
  for (const { email, motDePasse, role } of users) {
    const motDePasseHache = await passwordHasher.hash(motDePasse);
    const user = await prisma.utilisateur.upsert({
      where: { email },
      update: {},
      create: { email, motDePasseHache, role },
    });
    idsByEmail.set(email, user.id);
  }
  return (email: string) => {
    const id = idsByEmail.get(email);
    if (id === undefined) throw new Error(`Compte de démonstration inconnu : ${email}`);
    return id;
  };
}

async function seed() {
  // Hachage hors transaction : bcrypt est volontairement lent.
  const userId = await seedUsers();

  await prisma.$transaction(async (tx) => {
    for (const book of books) {
      await tx.ouvrage.upsert({ where: { id: book.id }, update: book, create: book });
    }
    for (const { emprunteur, ...loan } of loans) {
      await tx.emprunt.upsert({ where: { id: loan.id }, update: {}, create: { ...loan, emprunteurId: userId(emprunteur) } });
    }
    for (const { membre, ...reservation } of reservations) {
      const data = { ...reservation, membreId: userId(membre) };
      await tx.reservation.upsert({ where: { id: reservation.id }, update: {}, create: data });
    }
    // La disponibilité découle des emprunts réellement en cours dans la base.
    for (const { id } of books) {
      const activeLoans = await tx.emprunt.count({ where: { ouvrageId: id, rendu: false } });
      await tx.ouvrage.update({ where: { id }, data: { disponible: activeLoans === 0 } });
    }
  });

  await syncSequence("Ouvrage");
  await syncSequence("Emprunt");
  await syncSequence("Reservation");
  console.log(
    `Seed terminé : ${users.length} comptes, ${books.length} ouvrages, ${loans.length} emprunts, ${reservations.length} réservation.`,
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
