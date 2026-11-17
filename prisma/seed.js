// Seeder rejouable : upsert par identifiant fixe, aucun doublon après plusieurs exécutions.
import { config } from "../src/config.js";
import { createPrismaClient } from "../src/db/prisma.js";
import { books, loans } from "./seed-data.js";

const prisma = createPrismaClient(config.databaseUrl);

// Les identifiants fixes n'avancent pas la séquence : on la recale sur le maximum.
async function syncSequence(table) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
  );
}

async function seed() {
  await prisma.$transaction(async (tx) => {
    for (const book of books) {
      await tx.ouvrage.upsert({ where: { id: book.id }, update: book, create: book });
    }
    for (const loan of loans) {
      await tx.emprunt.upsert({ where: { id: loan.id }, update: {}, create: loan });
    }
    // La disponibilité découle des emprunts réellement en cours dans la base.
    for (const { id } of books) {
      const activeLoans = await tx.emprunt.count({ where: { ouvrageId: id, rendu: false } });
      await tx.ouvrage.update({ where: { id }, data: { disponible: activeLoans === 0 } });
    }
  });

  await syncSequence("Ouvrage");
  await syncSequence("Emprunt");
  console.log(`Seed terminé : ${books.length} ouvrages, ${loans.length} emprunts.`);
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
