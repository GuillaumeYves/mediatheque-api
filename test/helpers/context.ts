import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before } from "node:test";
import { createApp } from "../../src/app.ts";
import { type Config, loadConfig } from "../../src/config.ts";
import { createPrismaClient, type PrismaClient } from "../../src/db/prisma.ts";
import type { Role } from "../../src/domain/types.ts";
import { createPasswordHasher } from "../../src/security/password.ts";

const TABLES = ["consommation_ia", '"RefreshToken"', '"Reservation"', '"Emprunt"', '"Ouvrage"', '"Utilisateur"'];

export const PASSWORD = "Mot-de-passe-de-test-1";

// Comptes créés pour chaque suite.
export const ACCOUNTS = {
  librarian: { email: "biblio@example.net", role: "bibliothecaire" },
  alice: { email: "alice@example.net", role: "membre" },
  bob: { email: "bob@example.net", role: "membre" },
} as const satisfies Record<string, { email: string; role: Role }>;

export type AccountKey = keyof typeof ACCOUNTS;

// Les réponses sont inspectées librement dans les assertions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export interface ApiResponse {
  status: number;
  headers: Headers;
  body: Json;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

interface Overrides {
  corsOrigins?: string[];
  rateLimit?: Partial<Config["rateLimit"]>;
  stubDelayMs?: number;
  dailyTokenQuota?: number;
}

export interface TestContext {
  prisma: PrismaClient;
  config: Config;
  baseUrl: string;
  users: Record<AccountKey, { id: number }>;
  api(path: string, options?: RequestOptions): Promise<ApiResponse>;
  login(account: AccountKey): Promise<Json>;
  createBook(data?: { titre?: string; disponible?: boolean }): Promise<{ id: number }>;
}

// Prépare une base vide, des comptes et une application à l'écoute sur un port éphémère.
// onReady s'exécute une fois le serveur prêt, dans le même hook, pour garantir l'ordre.
export function useTestContext(overrides: Overrides = {}, { onReady }: { onReady?: (ctx: TestContext) => Promise<void> } = {}) {
  const context = {} as TestContext;
  let server: Server;

  before(async () => {
    const base = loadConfig();
    const config: Config = {
      ...base,
      corsOrigins: overrides.corsOrigins ?? base.corsOrigins,
      rateLimit: { ...base.rateLimit, ...overrides.rateLimit },
      // Les tests n'appellent jamais de fournisseur réel.
      assistant: {
        ...base.assistant,
        provider: "bouchon",
        stubDelayMs: overrides.stubDelayMs ?? 0,
        dailyTokenQuota: overrides.dailyTokenQuota ?? base.assistant.dailyTokenQuota,
      },
    };
    const prisma = createPrismaClient(config.databaseUrl);
    await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);

    const motDePasseHache = await createPasswordHasher({ cost: config.auth.bcryptCost }).hash(PASSWORD);
    const users = {} as TestContext["users"];
    for (const [key, { email, role }] of Object.entries(ACCOUNTS) as [AccountKey, (typeof ACCOUNTS)[AccountKey]][]) {
      users[key] = await prisma.utilisateur.create({ data: { email, role, motDePasseHache } });
    }

    server = createApp({ prisma, config }).listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    Object.assign(context, { prisma, config, users, baseUrl: `http://localhost:${port}` });
    await onReady?.(context);
  });

  after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await context.prisma.$disconnect();
  });

  // Requête JSON, avec jeton Bearer facultatif ; renvoie statut, en-têtes et corps.
  context.api = async (path, { method = "GET", body, token, headers = {} } = {}) => {
    const response = await fetch(context.baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await response.text();
    const isJson = response.headers.get("content-type")?.includes("application/json");
    return { status: response.status, headers: response.headers, body: isJson && text ? JSON.parse(text) : text };
  };

  context.login = async (account) => {
    const { body } = await context.api("/api/auth/connexion", {
      method: "POST",
      body: { email: ACCOUNTS[account].email, motDePasse: PASSWORD },
    });
    return body;
  };

  context.createBook = (data = {}) =>
    context.prisma.ouvrage.create({ data: { titre: "Ouvrage de test", auteur: "Auteur Fictif", annee: 2000, ...data } });

  return context;
}

export interface SseEvent {
  event: string;
  data: Json;
}

// Découpe un corps text/event-stream en événements ; "message" est le type par défaut.
export function parseSse(text: string): SseEvent[] {
  return text
    .split("\n\n")
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const lines = block.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
      const data = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "null";
      return { event, data: JSON.parse(data) };
    });
}

// Connecte les trois comptes une fois le serveur prêt et range leurs access tokens.
export function withTokens(tokens: Partial<Record<AccountKey, string>>) {
  return async (context: TestContext) => {
    for (const account of Object.keys(ACCOUNTS) as AccountKey[]) {
      tokens[account] = (await context.login(account)).accessToken;
    }
  };
}
