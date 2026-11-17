// Point d'entrée : connexion à la base, démarrage du serveur et arrêt propre.
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createPrismaClient } from "./db/prisma.js";

const prisma = createPrismaClient(config.databaseUrl);
const server = createApp({ prisma }).listen(config.port, () => {
  console.log(`API médiathèque à l'écoute sur http://localhost:${config.port}`);
});

// Termine les requêtes en cours puis ferme le pool de connexions.
async function shutdown(signal) {
  console.log(`${signal} reçu, arrêt en cours`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
