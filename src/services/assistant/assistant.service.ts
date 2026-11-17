import type { AuthUser } from "../../domain/types.ts";
import type { ConversationMemory } from "./memory.ts";
import { estimateInputTokens, estimateTokens } from "./tokens.ts";
import type { AssistantEvent, AssistantProvider, AssistantTool, TokenUsage } from "./types.ts";

// Cadre fixe donné au modèle. Les règles d'accès ne reposent pas dessus : elles sont dans les outils.
export const ASSISTANT_INSTRUCTIONS = [
  "Vous êtes l'assistant d'une médiathèque associative. Répondez en français, brièvement et poliment.",
  "Pour toute question sur le catalogue, les emprunts ou les réservations, utilisez les outils fournis",
  "et appuyez-vous uniquement sur leurs résultats. N'inventez jamais d'ouvrage ni de date.",
  "Vous ne connaissez que l'utilisateur connecté : ne parlez jamais d'autres membres.",
  "Si la demande sort du cadre de la médiathèque, dites-le simplement.",
].join(" ");

interface AssistantDependencies {
  provider: AssistantProvider;
  memory: ConversationMemory;
  buildTools(user: AuthUser): AssistantTool[];
  // Enregistre les jetons d'une réponse, base du quota journalier.
  recordUsage(userId: number, usage: TokenUsage): Promise<void>;
  log(message: string): void;
}

export interface AskInput {
  user: AuthUser;
  question: string;
  signal: AbortSignal;
}

// Orchestration : historique, outils de l'utilisateur, fournisseur, mémoire et journal des jetons.
export function createAssistantService({ provider, memory, buildTools, recordUsage, log }: AssistantDependencies) {
  return {
    providerName: provider.name,

    async *ask({ user, question, signal }: AskInput): AsyncGenerator<AssistantEvent> {
      const history = memory.get(user.id);
      const stream = provider.stream({ instructions: ASSISTANT_INSTRUCTIONS, history, question, tools: buildTools(user), signal });

      // Enregistre la consommation et la journalise, flux complet ou non.
      const account = async (usage: TokenUsage, status: string) => {
        await recordUsage(user.id, usage);
        log(`assistant utilisateur=${user.id} fournisseur=${provider.name} jetons=${usage.inputTokens}+${usage.outputTokens} ${status}`);
      };

      let answer = "";
      let accounted = false;
      try {
        for await (const event of stream) {
          if (event.type === "delta") answer += event.text;
          if (event.type === "done") {
            // Un échange n'entre en mémoire que s'il est complet.
            memory.append(user.id, [
              { role: "user", content: question },
              { role: "assistant", content: answer.trim() },
            ]);
            accounted = true;
            await account(event.usage, "complet");
          }
          yield event;
        }
      } finally {
        // Flux coupé ou en erreur : le fournisseur facture ce qui a déjà été généré,
        // donc la consommation estimée compte aussi dans le quota.
        if (!accounted) {
          await account(
            { inputTokens: estimateInputTokens(ASSISTANT_INSTRUCTIONS, history, question), outputTokens: estimateTokens(answer) },
            "interrompu (estimation)",
          );
        }
      }
    },

    forget: (userId: number) => memory.clear(userId),
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
