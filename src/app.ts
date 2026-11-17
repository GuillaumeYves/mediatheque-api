import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import type { Config } from "./config.ts";
import type { PrismaClient } from "./db/prisma.ts";
import { buildOpenApiDocument } from "./http/openapi.ts";
import { mountGroup, type RouteGroup } from "./http/route.ts";
import { authenticate } from "./middlewares/authenticate.ts";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.ts";
import { createQuotaIa } from "./middlewares/quota-ia.ts";
import { requestLogger } from "./middlewares/request-logger.ts";
import { corsPolicy, perUserKey, rateLimiter, securityHeaders } from "./middlewares/security.ts";
import { createDataAccess } from "./repositories/index.ts";
import { assistantRoutes } from "./routes/assistant.routes.ts";
import { authRoutes } from "./routes/auth.routes.ts";
import { bookRoutes } from "./routes/books.routes.ts";
import { healthRoutes } from "./routes/health.routes.ts";
import { loanRoutes } from "./routes/loans.routes.ts";
import { reservationRoutes } from "./routes/reservations.routes.ts";
import { createPasswordHasher } from "./security/password.ts";
import { createTokenService } from "./security/tokens.ts";
import { createAssistantService } from "./services/assistant/assistant.service.ts";
import { createConversationMemory } from "./services/assistant/memory.ts";
import { createAssistantProvider } from "./services/assistant/provider.ts";
import { createAssistantTools } from "./services/assistant/tools.ts";
import { createAuthService } from "./services/auth.service.ts";
import { createBookService } from "./services/book.service.ts";
import { createLoanService } from "./services/loan.service.ts";
import { createReservationService } from "./services/reservation.service.ts";

interface AppDependencies {
  prisma: PrismaClient;
  config: Config;
}

const API_INFO = {
  title: "Médiathèque API",
  version: "2.0.0",
  description: "Catalogue, emprunts, réservations et assistant d'une médiathèque associative.",
};

// Construit les services : chaque couche reçoit ses dépendances, rien n'est global.
function createServices({ prisma, config }: AppDependencies) {
  const dataAccess = createDataAccess(prisma);
  const tokenService = createTokenService(config.auth);
  const bookService = createBookService(dataAccess);
  const loanService = createLoanService(dataAccess, { loanDurationDays: config.loanDurationDays });
  const reservationService = createReservationService(dataAccess);
  const { usage } = dataAccess.repositories;

  return {
    quotaIa: createQuotaIa(usage),
    tokenService,
    bookService,
    loanService,
    reservationService,
    authService: createAuthService({
      dataAccess,
      passwordHasher: createPasswordHasher({ cost: config.auth.bcryptCost }),
      tokenService,
    }),
    assistantService: createAssistantService({
      provider: createAssistantProvider(config.assistant),
      memory: createConversationMemory({ maxExchanges: config.assistant.memoryExchanges }),
      buildTools: (user) => createAssistantTools(user, { bookService, loanService, reservationService }),
      recordUsage: async (utilisateurId, { inputTokens, outputTokens }) => {
        await usage.record({ utilisateurId, jetonsEntree: inputTokens, jetonsSortie: outputTokens });
      },
      log: (message) => console.log(message),
    }),
  };
}

// Assemble l'application à partir d'un client Prisma et d'une configuration, sans démarrer de serveur.
export function createApp({ prisma, config }: AppDependencies): Express {
  const services = createServices({ prisma, config });
  const { rateLimit } = config;

  const groups: RouteGroup[] = [
    healthRoutes({ prisma }),
    authRoutes(services),
    bookRoutes(services),
    loanRoutes(services),
    reservationRoutes(services),
    assistantRoutes({
      assistantService: services.assistantService,
      guards: [
        rateLimiter({ max: rateLimit.assistantMax, windowMs: rateLimit.assistantWindowMs, keyGenerator: perUserKey }),
        services.quotaIa(config.assistant.dailyTokenQuota),
      ],
    }),
  ];
  const openApiDocument = buildOpenApiDocument(groups, API_INFO);
  const requireAuth = authenticate(services.tokenService);

  const app = express();
  app.set("trust proxy", config.trustProxy);

  // Durcissement appliqué avant toute route.
  app.use(securityHeaders());
  app.use(corsPolicy(config.corsOrigins));
  app.use(rateLimiter({ max: rateLimit.globalMax, windowMs: rateLimit.globalWindowMs }));
  app.use(requestLogger);
  app.use(express.json({ limit: config.bodyLimit }));
  app.use("/api/auth", rateLimiter({ max: rateLimit.authMax, windowMs: rateLimit.authWindowMs }));

  // Documentation générée depuis les mêmes définitions que les routes.
  app.get("/api/docs.json", (req, res) => {
    res.json(openApiDocument);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: API_INFO.title }));

  for (const group of groups) app.use(group.prefix, mountGroup(group, requireAuth));

  // 404 après toutes les routes, gestionnaire d'erreurs en dernier.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
