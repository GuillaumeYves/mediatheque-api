import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuthUser } from "../src/domain/types.ts";
import type { BookService } from "../src/services/book.service.ts";
import type { LoanService } from "../src/services/loan.service.ts";
import type { ReservationService } from "../src/services/reservation.service.ts";
import { ASSISTANT_INSTRUCTIONS, type AssistantService, createAssistantService } from "../src/services/assistant/assistant.service.ts";
import { createConversationMemory } from "../src/services/assistant/memory.ts";
import { estimateInputTokens, estimateTokens } from "../src/services/assistant/tokens.ts";
import type { AssistantProvider, TokenUsage } from "../src/services/assistant/types.ts";
import { createAssistantTools } from "../src/services/assistant/tools.ts";

// Services factices : seuls les appels faits par les outils sont observés.
function fakeServices() {
  const calls: { service: string; actor?: AuthUser; args?: unknown }[] = [];
  const emptyPage = { donnees: [], page: 1, limite: 50, total: 0, pages: 0 };
  return {
    calls,
    services: {
      bookService: { search: async (term: string) => (calls.push({ service: "search", args: term }), []) } as unknown as BookService,
      loanService: { list: async (_query: unknown, actor: AuthUser) => (calls.push({ service: "loans", actor }), emptyPage) } as unknown as LoanService,
      reservationService: {
        list: async (_query: unknown, actor: AuthUser) => (calls.push({ service: "reservations", actor }), emptyPage),
      } as unknown as ReservationService,
    },
  };
}

const librarian: AuthUser = { id: 7, role: "bibliothecaire" };
const findTool = (tools: ReturnType<typeof createAssistantTools>, name: string) => tools.find((tool) => tool.name === name)!;

describe("Outils de l'assistant", () => {
  it("valide les arguments produits par le modèle avant d'appeler un service", async () => {
    const { calls, services } = fakeServices();
    const search = findTool(createAssistantTools(librarian, services), "rechercher_ouvrages");

    assert.deepEqual(await search.execute("pas du JSON"), { erreur: "Arguments JSON invalides" });
    assert.deepEqual(await search.execute(JSON.stringify({ requete: "" })), { erreur: "Arguments invalides" });
    assert.deepEqual(await search.execute(JSON.stringify({ requete: "zola", membreId: 1 })), { erreur: "Arguments invalides" });
    assert.equal(calls.length, 0);

    await search.execute(JSON.stringify({ requete: "zola" }));
    assert.deepEqual(calls, [{ service: "search", args: "zola" }]);
  });

  it("restreint mes_emprunts et mes_reservations au compte connecté, même bibliothécaire", async () => {
    const { calls, services } = fakeServices();
    const tools = createAssistantTools(librarian, services);
    await findTool(tools, "mes_emprunts").execute("{}");
    await findTool(tools, "mes_reservations").execute("{}");
    assert.deepEqual(
      calls.map(({ actor }) => actor),
      [{ id: 7, role: "membre" }, { id: 7, role: "membre" }],
    );
  });

  it("décrit des paramètres JSON Schema sans aucun identifiant d'utilisateur", () => {
    const { services } = fakeServices();
    for (const tool of createAssistantTools(librarian, services)) {
      assert.equal(tool.parameters.type, "object");
      assert.equal(tool.parameters.$schema, undefined);
      assert.doesNotMatch(JSON.stringify(tool.parameters), /membre|utilisateur|emprunteur/i);
    }
  });
});

// Fournisseur factice : diffuse trois fragments, puis termine, s'arrête ou échoue.
function fakeProvider(ending: "done" | "silent" | "error"): AssistantProvider {
  return {
    name: "factice",
    async *stream() {
      for (const text of ["un ", "deux ", "trois "]) yield { type: "delta", text };
      if (ending === "error") throw new Error("panne du fournisseur");
      if (ending === "done") yield { type: "done", usage: { inputTokens: 100, outputTokens: 3 } };
    },
  };
}

function serviceWith(provider: AssistantProvider) {
  const recorded: TokenUsage[] = [];
  const service = createAssistantService({
    provider,
    memory: createConversationMemory({ maxExchanges: 2 }),
    buildTools: () => [],
    recordUsage: async (_userId, usage) => void recorded.push(usage),
    log: () => undefined,
  });
  return { service, recorded };
}

const ask = (service: AssistantService) => service.ask({ user: librarian, question: "Bonjour", signal: new AbortController().signal });

describe("Consommation des flux de l'assistant", () => {
  it("enregistre l'usage réel du fournisseur pour un flux complet, une seule fois", async () => {
    const { service, recorded } = serviceWith(fakeProvider("done"));
    for await (const _event of ask(service));
    assert.deepEqual(recorded, [{ inputTokens: 100, outputTokens: 3 }]);
  });

  it("décompte une estimation quand le client coupe le flux en cours", async () => {
    const { service, recorded } = serviceWith(fakeProvider("done"));
    for await (const event of ask(service)) if (event.type === "delta") break;
    assert.deepEqual(recorded, [
      { inputTokens: estimateInputTokens(ASSISTANT_INSTRUCTIONS, [], "Bonjour"), outputTokens: estimateTokens("un ") },
    ]);
  });

  it("décompte une estimation quand le fournisseur s'arrête ou échoue en route", async () => {
    for (const ending of ["silent", "error"] as const) {
      const { service, recorded } = serviceWith(fakeProvider(ending));
      await (async () => {
        for await (const _event of ask(service));
      })().catch(() => undefined);
      assert.equal(recorded.length, 1);
      assert.equal(recorded[0]?.outputTokens, estimateTokens("un deux trois "));
    }
  });
});

describe("Mémoire de conversation", () => {
  it("conserve les derniers échanges par utilisateur, sans mélanger les comptes", () => {
    const memory = createConversationMemory({ maxExchanges: 2 });
    for (const index of [1, 2, 3]) {
      memory.append(1, [
        { role: "user", content: `question ${index}` },
        { role: "assistant", content: `réponse ${index}` },
      ]);
    }
    assert.deepEqual(
      memory.get(1).map(({ content }) => content),
      ["question 2", "réponse 2", "question 3", "réponse 3"],
    );
    assert.deepEqual(memory.get(2), []);

    memory.clear(1);
    assert.deepEqual(memory.get(1), []);
  });
});
