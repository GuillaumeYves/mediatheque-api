import type { PrismaClient } from "../db/prisma.ts";
import { defineRoute, type RouteGroup } from "../http/route.ts";
import { healthSchema } from "../schemas/responses.schema.ts";

// /sante : sonde de santé, vérifie aussi que la base répond.
export function healthRoutes({ prisma }: { prisma: PrismaClient }): RouteGroup {
  return {
    prefix: "/sante",
    tag: "Santé",
    description: "Supervision.",
    routes: [
      defineRoute({
        method: "get",
        path: "/",
        summary: "État de l'API et de la base",
        access: "public",
        responses: {
          200: { description: "API et base opérationnelles", schema: healthSchema },
          503: { description: "Base injoignable", schema: healthSchema },
        },
        handler: async () => {
          try {
            await prisma.$queryRaw`SELECT 1`;
            return { status: 200, body: { statut: "ok", base: "ok" } };
          } catch {
            return { status: 503, body: { statut: "degrade", base: "indisponible" } };
          }
        },
      }),
    ],
  };
}
