# Image de production en deux étapes : compilation TypeScript, puis exécution sans dépendances de développement.

# OpenSSL est requis par le moteur de migration de Prisma.
FROM node:24-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Étape 1 : dépendances complètes, client Prisma généré, compilation, puis retrait des dépendances de développement.
FROM base AS build
# Valeur factice : la configuration Prisma l'exige, aucune connexion n'est ouverte ici.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/schema.prisma prisma/schema.prisma
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN npm run build && npm prune --omit=dev && npm cache clean --force

# Étape 2 : uniquement ce qui sert à l'exécution, utilisateur non privilégié.
FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY package.json prisma.config.ts ./
COPY prisma prisma
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:' + process.env.PORT + '/sante').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Migrations appliquées au démarrage, puis le processus Node remplace le shell pour recevoir SIGTERM.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/index.js"]
