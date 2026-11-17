import {
  createDocument,
  type ZodOpenApiObject,
  type ZodOpenApiOperationObject,
  type ZodOpenApiPathsObject,
} from "zod-openapi";
import type { z } from "zod";
import type { RouteDefinition, RouteGroup } from "./route.ts";

type DocumentInfo = ZodOpenApiObject["info"];

// Chemin Express (/:id) vers chemin OpenAPI (/{id}).
const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, "{$1}");

function describeAccess(route: RouteDefinition): string {
  if (route.access === "public") return "Accès public.";
  if (route.access === "authenticated") return "Accès : tout compte connecté.";
  return `Accès : ${route.access.join(", ")}.`;
}

function toOperation(route: RouteDefinition, tag: string): ZodOpenApiOperationObject {
  const params = route.params as z.ZodObject | undefined;
  const query = route.query as z.ZodObject | undefined;
  const body = route.body as z.ZodType | undefined;

  return {
    tags: [tag],
    summary: route.summary,
    description: [route.description, describeAccess(route)].filter(Boolean).join("\n\n"),
    ...(route.access !== "public" && { security: [{ bearerAuth: [] }] }),
    ...((params || query) && { requestParams: { ...(params && { path: params }), ...(query && { query }) } }),
    ...(body && { requestBody: { required: true, content: { "application/json": { schema: body } } } }),
    responses: Object.fromEntries(
      Object.entries(route.responses).map(([status, spec]) => [
        status,
        {
          description: spec.description,
          ...(spec.schema && { content: { [spec.contentType ?? "application/json"]: { schema: spec.schema } } }),
        },
      ]),
    ),
  };
}

// Spécification OpenAPI 3.1 générée depuis les mêmes définitions que le routage.
export function buildOpenApiDocument(groups: RouteGroup[], info: DocumentInfo) {
  const paths: ZodOpenApiPathsObject = {};
  for (const group of groups) {
    for (const route of group.routes) {
      const path = toOpenApiPath(group.prefix + (route.path === "/" ? "" : route.path));
      paths[path] = { ...paths[path], [route.method]: toOperation(route, group.tag) };
    }
  }

  return createDocument({
    openapi: "3.1.0",
    info,
    tags: groups.map(({ tag, description }) => ({ name: tag, description })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Access token obtenu à la connexion" },
      },
    },
  });
}
