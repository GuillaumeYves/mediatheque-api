import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/client.ts";

// Client Prisma branché sur le pool de connexions du pilote pg.
export function createPrismaClient(connectionString) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
