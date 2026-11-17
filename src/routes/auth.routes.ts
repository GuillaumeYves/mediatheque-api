import { errors } from "../http/responses.ts";
import { created, defineRoute, noContent, ok, type RouteGroup } from "../http/route.ts";
import { loginSchema, refreshSchema, registerSchema } from "../schemas/auth.schema.ts";
import { sessionSchema, tokensSchema, userSchema } from "../schemas/responses.schema.ts";
import type { AuthService } from "../services/auth.service.ts";

// /api/auth : inscription, connexion, rafraîchissement, déconnexion.
export function authRoutes({ authService }: { authService: AuthService }): RouteGroup {
  return {
    prefix: "/api/auth",
    tag: "Authentification",
    description: "Comptes et jetons. Limité à 10 requêtes par quart d'heure et par adresse IP.",
    routes: [
      defineRoute({
        method: "post",
        path: "/inscription",
        summary: "Créer un compte membre",
        description: "Le rôle est toujours membre : un champ role envoyé par le client est ignoré.",
        access: "public",
        body: registerSchema,
        responses: { 201: { description: "Compte créé", schema: userSchema }, ...errors(400, 409, 429) },
        handler: async ({ body }) => created(await authService.register(body)),
      }),

      defineRoute({
        method: "post",
        path: "/connexion",
        summary: "Se connecter",
        description: "Renvoie un access token (15 minutes) et un refresh token. Même 401 que le compte existe ou non.",
        access: "public",
        body: loginSchema,
        responses: { 200: { description: "Session ouverte", schema: sessionSchema }, ...errors(400, 401, 429) },
        handler: async ({ body }) => ok(await authService.login(body)),
      }),

      defineRoute({
        method: "post",
        path: "/rafraichir",
        summary: "Renouveler les jetons",
        description: "Rotation : l'ancien refresh token est révoqué. Rejouer un jeton révoqué coupe toute la session.",
        access: "public",
        body: refreshSchema,
        responses: { 200: { description: "Nouveaux jetons", schema: tokensSchema }, ...errors(400, 401, 429) },
        handler: async ({ body }) => ok(await authService.refresh(body)),
      }),

      defineRoute({
        method: "post",
        path: "/deconnexion",
        summary: "Se déconnecter",
        description: "Révoque tous les refresh tokens du compte.",
        access: "authenticated",
        responses: { 204: { description: "Session fermée" }, ...errors(401, 429) },
        handler: async ({ user }) => {
          await authService.logout(user.id);
          return noContent();
        },
      }),

      defineRoute({
        method: "get",
        path: "/moi",
        summary: "Compte connecté",
        access: "authenticated",
        responses: { 200: { description: "Compte", schema: userSchema }, ...errors(401, 429) },
        handler: async ({ user }) => ok(await authService.me(user.id)),
      }),
    ],
  };
}
