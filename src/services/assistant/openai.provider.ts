import OpenAI from "openai";
import type { ResponseFunctionToolCall, ResponseInput } from "openai/resources/responses/responses";
import type { AssistantProvider } from "./types.ts";

// Borne le nombre d'allers-retours outil puis modèle : pas de boucle infinie, pas de facture surprise.
const MAX_TOOL_ROUNDS = 3;

interface OpenAiSettings {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
}

// Fournisseur OpenAI : API Responses en streaming, avec appel d'outils.
export function createOpenAiProvider({ apiKey, model, maxOutputTokens }: OpenAiSettings): AssistantProvider {
  const client = new OpenAI({ apiKey });

  return {
    name: "openai",

    async *stream({ instructions, history, question, tools, signal }) {
      const input: ResponseInput = [
        ...history.map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: question },
      ];
      const toolDefinitions = tools.map((tool) => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: true,
      }));
      const usage = { inputTokens: 0, outputTokens: 0 };

      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const events = await client.responses.create(
          { model, instructions, input, tools: toolDefinitions, max_output_tokens: maxOutputTokens, stream: true },
          { signal },
        );
        const calls: ResponseFunctionToolCall[] = [];

        for await (const event of events) {
          if (event.type === "response.output_text.delta") {
            yield { type: "delta", text: event.delta };
          } else if (event.type === "response.output_item.done" && event.item.type === "function_call") {
            calls.push(event.item);
          } else if (event.type === "response.completed" && event.response.usage) {
            // Chaque appel se facture : on additionne les tours.
            usage.inputTokens += event.response.usage.input_tokens;
            usage.outputTokens += event.response.usage.output_tokens;
          }
        }
        if (calls.length === 0) break;

        // Le modèle demande, le serveur exécute avec les droits de l'utilisateur.
        for (const call of calls) {
          yield { type: "tool", name: call.name };
          const tool = tools.find((candidate) => candidate.name === call.name);
          const output = tool ? await tool.execute(call.arguments) : { erreur: "Outil inconnu" };
          input.push(call, { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
        }
      }
      yield { type: "done", usage };
    },
  };
}
