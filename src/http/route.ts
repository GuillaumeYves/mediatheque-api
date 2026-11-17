import { Router, type Request, type RequestHandler, type Response } from "express";
import type { z } from "zod";
import type { AuthUser, Role } from "../domain/types.ts";
import { badRequest, forbidden, type FieldError, unauthorized } from "../erreurs.ts";

export type Method = "get" | "post" | "patch" | "delete";

// Accès d'une route : publique, tout compte connecté, ou rôles précis.
export type Access = "public" | "authenticated" | readonly Role[];

export interface ResponseSpec {
  description: string;
  schema?: z.ZodType;
  contentType?: string;
}

type Input<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface RouteContext<P, Q, B> {
  params: P;
  query: Q;
  body: B;
  // Compte connecté ; lève 401 si la route est publique et qu'aucun jeton n'a été vérifié.
  user: AuthUser;
  req: Request;
  res: Response;
}

export interface Reply {
  status: number;
  body?: unknown;
}

// Une route décrite une seule fois : routage, validation, droits et documentation.
export interface RouteDefinition<P = unknown, Q = unknown, B = unknown> {
  method: Method;
  path: string;
  summary: string;
  description?: string;
  access: Access;
  params?: P;
  query?: Q;
  body?: B;
  middlewares?: RequestHandler[];
  responses: Record<number, ResponseSpec>;
  // undefined signifie que le handler a écrit la réponse lui-même (flux SSE).
  handler(context: RouteContext<Input<P>, Input<Q>, Input<B>>): Promise<Reply | undefined>;
}

export interface RouteGroup {
  prefix: string;
  tag: string;
  description: string;
  routes: RouteDefinition[];
}

export function defineRoute<
  P extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
>(definition: RouteDefinition<P, Q, B>): RouteDefinition {
  return definition as RouteDefinition;
}

export const ok = (body: unknown): Reply => ({ status: 200, body });
export const created = (body: unknown): Reply => ({ status: 201, body });
export const noContent = (): Reply => ({ status: 204 });

const SOURCES = ["params", "query", "body"] as const;

// Valide les trois sources d'entrée et rassemble tous les champs fautifs.
function parseInput(route: RouteDefinition, req: Request) {
  const input: Record<(typeof SOURCES)[number], unknown> = { params: undefined, query: undefined, body: undefined };
  const errors: FieldError[] = [];

  for (const source of SOURCES) {
    const schema = route[source] as z.ZodType | undefined;
    if (!schema) continue;
    const result = schema.safeParse(req[source] ?? {});
    if (result.success) input[source] = result.data;
    else {
      errors.push(...result.error.issues.map((issue) => ({ champ: [source, ...issue.path].join("."), message: issue.message })));
    }
  }
  if (errors.length > 0) throw badRequest("Données invalides", errors);
  return input;
}

function accessGuards(access: Access, authenticate: RequestHandler): RequestHandler[] {
  if (access === "public") return [];
  if (access === "authenticated") return [authenticate];
  const roles: readonly Role[] = access;
  const requireRole: RequestHandler = (req, res, next) => {
    next(req.utilisateur && roles.includes(req.utilisateur.role) ? undefined : forbidden("Rôle insuffisant"));
  };
  return [authenticate, requireRole];
}

function toHandler(route: RouteDefinition): RequestHandler {
  return async (req, res) => {
    const input = parseInput(route, req);
    const context = {
      ...input,
      req,
      res,
      get user(): AuthUser {
        if (!req.utilisateur) throw unauthorized();
        return req.utilisateur;
      },
    } as RouteContext<never, never, never>;

    const reply = await route.handler(context);
    if (!reply) return;
    if (reply.body === undefined) res.status(reply.status).end();
    else res.status(reply.status).json(reply.body);
  };
}

// Monte un groupe sur un routeur Express : authentification, rôle, middlewares, validation, handler.
export function mountGroup(group: RouteGroup, authenticate: RequestHandler): Router {
  const router = Router();
  for (const route of group.routes) {
    router[route.method](
      route.path,
      ...accessGuards(route.access, authenticate),
      ...(route.middlewares ?? []),
      toHandler(route),
    );
  }
  return router;
}
