import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import type { Prisma } from "../generated/prisma/client.ts";

// Client complet ou client d'une transaction : les dépôts acceptent les deux.
export type Db = PrismaClient | Prisma.TransactionClient;

export type { PrismaClient };

// Client Prisma branché sur le pool de connexions du pilote pg.
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
