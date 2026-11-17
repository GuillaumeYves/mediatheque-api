// Point d'entrée : connexion à la base, démarrage du serveur et arrêt propre.
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createPrismaClient } from "./db/prisma.ts";

const config = loadConfig();
const prisma = createPrismaClient(config.databaseUrl);
const server = createApp({ prisma, config }).listen(config.port, () => {
  console.log(`API médiathèque à l'écoute sur http://localhost:${config.port} (assistant : ${config.assistant.provider})`);
});

// Termine les requêtes en cours puis ferme le pool de connexions.
function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} reçu, arrêt en cours`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Les flux SSE ouverts ne doivent pas bloquer l'arrêt indéfiniment.
  setTimeout(() => server.closeAllConnections(), 5_000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
