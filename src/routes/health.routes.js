import { Router } from "express";

// Sonde de santé : vérifie aussi que la base répond.
export function createHealthRouter({ prisma }) {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ statut: "ok", base: "ok" });
    } catch {
      res.status(503).json({ statut: "degrade", base: "indisponible" });
    }
  });

  return router;
}
