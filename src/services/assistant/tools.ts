import { z } from "zod";
import type { AuthUser } from "../../domain/types.ts";
import type { BookService } from "../book.service.ts";
import type { LoanService } from "../loan.service.ts";
import type { ReservationService } from "../reservation.service.ts";
import type { AssistantTool } from "./types.ts";

const MAX_ITEMS = 50;

interface ToolDefinition<S extends z.ZodObject> {
  name: string;
  description: string;
  arguments: S;
  run(args: z.output<S>): Promise<unknown>;
}

// Les arguments produits par le modèle sont une entrée comme une autre : ils sont validés.
function defineTool<S extends z.ZodObject>(definition: ToolDefinition<S>): AssistantTool {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(definition.arguments) as Record<string, unknown>;
  return {
    name: definition.name,
    description: definition.description,
    parameters,
    async execute(rawArguments) {
      let json: unknown;
      try {
        json = JSON.parse(rawArguments || "{}");
      } catch {
        return { erreur: "Arguments JSON invalides" };
      }
      const parsed = definition.arguments.safeParse(json);
      if (!parsed.success) return { erreur: "Arguments invalides" };
      return definition.run(parsed.data);
    },
  };
}

interface ToolServices {
  bookService: BookService;
  loanService: LoanService;
  reservationService: ReservationService;
}

// Outils construits pour un utilisateur donné : ils n'exposent que ce qu'il a le droit de voir.
// Aucun outil ne prend d'identifiant d'utilisateur en argument.
export function createAssistantTools(user: AuthUser, { bookService, loanService, reservationService }: ToolServices) {
  return [
    defineTool({
      name: "rechercher_ouvrages",
      description: "Recherche des ouvrages du catalogue par mots du titre ou de l'auteur et indique leur disponibilité.",
      arguments: z.object({ requete: z.string().min(1).max(100).describe("Mots du titre ou de l'auteur") }).strict(),
      run: ({ requete }) => bookService.search(requete),
    }),

    defineTool({
      name: "mes_emprunts",
      description: "Liste les emprunts en cours de l'utilisateur connecté, avec leur date de retour prévue.",
      arguments: z.object({}).strict(),
      run: async () => {
        // Toujours filtré sur l'utilisateur lui-même, même pour un bibliothécaire.
        const page = await loanService.list({ page: 1, limite: MAX_ITEMS, rendu: false }, { ...user, role: "membre" });
        return page.donnees.map((loan) => ({
          titre: loan.ouvrage.titre,
          auteur: loan.ouvrage.auteur,
          retourPrevuLe: loan.retourPrevuLe.toISOString(),
        }));
      },
    }),

    defineTool({
      name: "mes_reservations",
      description: "Liste les réservations actives de l'utilisateur connecté.",
      arguments: z.object({}).strict(),
      run: async () => {
        const page = await reservationService.list(
          { page: 1, limite: MAX_ITEMS, statut: "active" },
          { ...user, role: "membre" },
        );
        return page.donnees.map((reservation) => ({
          titre: reservation.ouvrage.titre,
          auteur: reservation.ouvrage.auteur,
          reserveeLe: reservation.creeLe.toISOString(),
        }));
      },
    }),
  ];
}
