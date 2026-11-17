import "dotenv/config";

const MIN_SECRET_LENGTH = 32;
const MIN_BCRYPT_COST = 12;
const MAX_ACCESS_TTL_SECONDS = 900;
const AI_PROVIDERS = ["openai", "bouchon"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

// Lit une variable obligatoire, échoue tôt si elle manque.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} doit être un entier`);
  return value;
}

function secret(name: string): string {
  const value = required(name);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} doit contenir au moins ${MIN_SECRET_LENGTH} caractères`);
  }
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function aiProvider(): AiProvider {
  const value = process.env.IA_FOURNISSEUR ?? "bouchon";
  if (!AI_PROVIDERS.includes(value as AiProvider)) {
    throw new Error(`IA_FOURNISSEUR doit valoir ${AI_PROVIDERS.join(" ou ")}`);
  }
  return value as AiProvider;
}

// Configuration complète, construite une fois au démarrage.
export function loadConfig() {
  const provider = aiProvider();

  return {
    port: integer("PORT", 3000),
    databaseUrl: required("DATABASE_URL"),
    trustProxy: integer("TRUST_PROXY", 0),
    bodyLimit: "100kb",
    corsOrigins: list("CORS_ORIGINS"),
    loanDurationDays: integer("DUREE_EMPRUNT_JOURS", 14),
    auth: {
      accessSecret: secret("JWT_ACCESS_SECRET"),
      accessTtlSeconds: Math.min(integer("ACCESS_TOKEN_TTL_SECONDS", MAX_ACCESS_TTL_SECONDS), MAX_ACCESS_TTL_SECONDS),
      refreshTtlDays: integer("REFRESH_TOKEN_TTL_DAYS", 7),
      bcryptCost: Math.max(integer("BCRYPT_COST", MIN_BCRYPT_COST), MIN_BCRYPT_COST),
    },
    rateLimit: {
      authMax: integer("AUTH_RATE_LIMIT_MAX", 10),
      authWindowMs: 15 * 60 * 1000,
      globalMax: integer("GLOBAL_RATE_LIMIT_MAX", 300),
      globalWindowMs: 60 * 1000,
      assistantMax: integer("ASSISTANT_RATE_LIMIT_MAX", 10),
      assistantWindowMs: 60 * 1000,
    },
    assistant: {
      provider,
      // La clé n'est exigée qu'avec le fournisseur openai.
      openaiApiKey: provider === "openai" ? required("OPENAI_API_KEY") : undefined,
      model: process.env.OPENAI_MODELE ?? "gpt-4.1-mini",
      maxOutputTokens: integer("IA_MAX_JETONS_SORTIE", 400),
      memoryExchanges: 10,
      stubDelayMs: integer("IA_BOUCHON_DELAI_MS", 40),
      // Jetons d'entrée et de sortie autorisés par compte et par jour.
      dailyTokenQuota: integer("IA_QUOTA_JETONS_JOUR", 20_000),
    },
  };
}

export type Config = ReturnType<typeof loadConfig>;
