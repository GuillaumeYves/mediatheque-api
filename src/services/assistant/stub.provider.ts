import { setTimeout as sleep } from "node:timers/promises";
import { estimateInputTokens, estimateTokens } from "./tokens.ts";
import type { AssistantProvider, AssistantTool } from "./types.ts";

// Mots ignorés pour extraire le terme d'une recherche.
const STOP_WORDS = new Set(["avez", "vous", "livre", "livres", "ouvrage", "ouvrages", "auteur", "disponible", "cherche", "chercher", "sur", "des", "les", "une", "est", "qui", "que", "dans", "pour"]);

// Réponse sans outil : cinquante mots, assez long pour observer le flux et son interruption.
// Les espaces insécables devant « : » et « ? » évitent d'en faire des mots à part.
const DEFAULT_ANSWER = [
  "[bouchon] Bonjour, je suis l'assistant de la médiathèque.",
  "Je peux chercher un ouvrage dans le catalogue par son titre ou son auteur,",
  "lister vos emprunts en cours avec leur date de retour, et rappeler vos réservations actives.",
  "Posez votre question simplement, par exemple : quels livres d'Émile Zola avez-vous en rayon ?",
].join(" ");

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Choix de l'outil par mots-clés, à la place du raisonnement du modèle.
function pickTool(question: string): { name: string; args: Record<string, string> } | null {
  const text = normalize(question);
  if (/reserv/.test(text)) return { name: "mes_reservations", args: {} };
  if (/emprunt|rendre|retour|rapporter/.test(text)) return { name: "mes_emprunts", args: {} };
  if (/cherch|livre|ouvrage|auteur|disponible|avez/.test(text)) {
    const quoted = /[«"]\s*([^»"]+?)\s*[»"]/.exec(question)?.[1];
    const words = text.match(/[a-z0-9-]{3,}/g)?.filter((word) => !STOP_WORDS.has(word)) ?? [];
    return { name: "rechercher_ouvrages", args: { requete: quoted ?? words.at(-1) ?? text } };
  }
  return null;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

// Mise en phrase du résultat d'un outil.
function describe(toolName: string, result: unknown): string {
  if (!Array.isArray(result)) return "Je n'ai pas pu consulter ces informations.";
  if (result.length === 0) {
    if (toolName === "rechercher_ouvrages") return "Aucun ouvrage du catalogue ne correspond à votre recherche.";
    return toolName === "mes_emprunts" ? "Vous n'avez aucun emprunt en cours." : "Vous n'avez aucune réservation active.";
  }
  const lines = result.map((item: Record<string, string>) => {
    if (toolName === "mes_emprunts") return `« ${item.titre} » à rendre le ${formatDate(item.retourPrevuLe!)}`;
    if (toolName === "mes_reservations") return `« ${item.titre} » réservé le ${formatDate(item.reserveeLe!)}`;
    return `« ${item.titre} » de ${item.auteur} (${item.disponible ? "disponible" : "emprunté"})`;
  });
  const intro = {
    rechercher_ouvrages: "Voici les ouvrages trouvés :",
    mes_emprunts: "Voici vos emprunts en cours :",
    mes_reservations: "Voici vos réservations actives :",
  }[toolName];
  return `${intro} ${lines.join(" ; ")}.`;
}

async function runTool(tools: AssistantTool[], name: string, args: Record<string, string>) {
  const tool = tools.find((candidate) => candidate.name === name);
  return tool ? tool.execute(JSON.stringify(args)) : null;
}

// Fournisseur bouchon : sans clé, sans réseau, sans coût. Il utilise les vrais outils,
// donc les vraies règles d'accès, et diffuse sa réponse mot par mot.
export function createStubProvider({ delayMs }: { delayMs: number }): AssistantProvider {
  return {
    name: "bouchon",

    async *stream({ instructions, history, question, tools, signal }) {
      const choice = pickTool(question);
      let answer = DEFAULT_ANSWER;

      if (choice) {
        yield { type: "tool", name: choice.name };
        answer = `[bouchon] ${describe(choice.name, await runTool(tools, choice.name, choice.args))}`;
      }

      for (const word of answer.split(" ")) {
        if (signal.aborted) return;
        if (delayMs > 0) await sleep(delayMs, undefined, { signal }).catch(() => undefined);
        if (signal.aborted) return;
        yield { type: "delta", text: `${word} ` };
      }
      yield {
        type: "done",
        usage: { inputTokens: estimateInputTokens(instructions, history, question), outputTokens: estimateTokens(answer) },
      };
    },
  };
}
