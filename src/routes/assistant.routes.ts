import type { RequestHandler } from "express";
import { z } from "zod";
import { errors } from "../http/responses.ts";
import { defineRoute, noContent, type RouteGroup } from "../http/route.ts";
import { openEventStream } from "../http/sse.ts";
import { questionSchema } from "../schemas/assistant.schema.ts";
import type { AssistantService } from "../services/assistant/assistant.service.ts";

interface AssistantRoutesDependencies {
  assistantService: AssistantService;
  // Limite de débit puis quota journalier, appliqués avant la validation.
  guards: RequestHandler[];
}

const SSE_DESCRIPTION = [
  "Flux text/event-stream :",
  "- `data: {\"texte\": \"...\"}` pour chaque fragment de réponse ;",
  "- `event: outil` quand un outil est appelé ;",
  "- `event: fin` avec les jetons consommés ;",
  "- `event: erreur` si le fournisseur échoue.",
  "La génération s'arrête dès que le client ferme la connexion.",
].join("\n");

// /api/assistant : questions en langage naturel, réponse diffusée en Server-Sent Events.
export function assistantRoutes({ assistantService, guards }: AssistantRoutesDependencies): RouteGroup {
  return {
    prefix: "/api/assistant",
    tag: "Assistant",
    description: "Assistant de la médiathèque. Ses outils n'accèdent qu'aux données de l'utilisateur connecté.",
    routes: [
      defineRoute({
        method: "post",
        path: "/flux",
        summary: "Poser une question à l'assistant",
        description: `${SSE_DESCRIPTION}\n\nLimité à 10 questions par minute et par compte, et à un quota de jetons par jour (429 au-delà).`,
        access: "authenticated",
        middlewares: guards,
        body: questionSchema,
        responses: {
          200: { description: "Réponse diffusée en Server-Sent Events", contentType: "text/event-stream", schema: z.string() },
          ...errors(400, 401, 429),
        },
        handler: async ({ body, user, res }) => {
          const controller = new AbortController();
          let fragments = 0;
          // Le client ferme la connexion : on arrête la génération, donc la facturation.
          res.on("close", () => {
            if (res.writableFinished) return;
            controller.abort();
            console.log(`flux interrompu par le client après ${fragments} fragments (utilisateur=${user.id})`);
          });

          const stream = openEventStream(res);
          try {
            for await (const event of assistantService.ask({ user, question: body.question, signal: controller.signal })) {
              if (controller.signal.aborted) break;
              if (event.type === "delta") {
                fragments += 1;
                stream.send({ texte: event.text });
              } else if (event.type === "tool") {
                stream.send({ outil: event.name }, "outil");
              } else {
                stream.send({ jetons: event.usage }, "fin");
              }
            }
          } catch (error) {
            // Les en-têtes sont partis : l'erreur est signalée dans le flux, le détail reste au journal.
            if (!controller.signal.aborted) {
              console.error("assistant indisponible", error);
              stream.send({ erreur: "Assistant momentanément indisponible" }, "erreur");
            }
          } finally {
            stream.close();
          }
          return undefined;
        },
      }),

      defineRoute({
        method: "delete",
        path: "/memoire",
        summary: "Effacer la conversation",
        description: "Supprime l'historique de conversation de l'utilisateur connecté.",
        access: "authenticated",
        responses: { 204: { description: "Conversation effacée" }, ...errors(401) },
        handler: async ({ user }) => {
          assistantService.forget(user.id);
          return noContent();
        },
      }),
    ],
  };
}
