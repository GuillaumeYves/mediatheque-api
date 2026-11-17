import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTokenService } from "../src/security/tokens.ts";
import { type AccountKey, parseSse, useTestContext } from "./helpers/context.ts";

// Quota de l'assistant réduit pour tester le 429 sans dizaines de requêtes.
const ASSISTANT_MAX = 6;
const ctx = useTestContext({ rateLimit: { assistantMax: ASSISTANT_MAX } });

// Jetons signés directement : la route de connexion n'est pas l'objet de cette suite.
function tokenFor(account: AccountKey) {
  const role = account === "librarian" ? "bibliothecaire" : "membre";
  return createTokenService(ctx.config.auth).signAccessToken({ id: ctx.users[account].id, role });
}

async function ask(account: AccountKey, question: string) {
  const response = await ctx.api("/api/assistant/flux", {
    method: "POST",
    token: await tokenFor(account),
    body: { question },
  });
  return { ...response, events: response.status === 200 ? parseSse(response.body) : [] };
}

const answerText = (events: ReturnType<typeof parseSse>) =>
  events
    .filter(({ event }) => event === "message")
    .map(({ data }) => data.texte)
    .join("");

describe("Assistant (fournisseur bouchon)", () => {
  it("refuse une question sans jeton en 401", async () => {
    const { status } = await ctx.api("/api/assistant/flux", { method: "POST", body: { question: "Bonjour" } });
    assert.equal(status, 401);
  });

  it("refuse une question vide ou de plus de 500 caractères en 400", async () => {
    const tooLong = await ask("alice", "a".repeat(501));
    const empty = await ask("alice", "   ");
    assert.equal(tooLong.status, 400);
    assert.equal(empty.status, 400);
  });

  it("diffuse la réponse en Server-Sent Events et termine par un événement fin", async () => {
    const { status, headers, events } = await ask("alice", "Bonjour");
    assert.equal(status, 200);
    assert.match(headers.get("content-type") ?? "", /^text\/event-stream/);
    assert.ok(events.filter(({ event }) => event === "message").length > 1, "plusieurs fragments");

    const last = events.at(-1);
    assert.equal(last?.event, "fin");
    assert.ok(last?.data.jetons.outputTokens > 0, "les jetons consommés sont renvoyés");
  });

  it("appelle l'outil de recherche du catalogue et répond avec ses résultats", async () => {
    await ctx.prisma.ouvrage.create({ data: { titre: "Germinal", auteur: "Émile Zola", annee: 1885 } });
    const { events } = await ask("alice", "Avez-vous Germinal ?");
    assert.deepEqual(
      events.filter(({ event }) => event === "outil").map(({ data }) => data.outil),
      ["rechercher_ouvrages"],
    );
    assert.match(answerText(events), /Germinal/);
  });

  it("ne présente à un membre que ses propres emprunts", async () => {
    const mine = await ctx.prisma.ouvrage.create({ data: { titre: "Titre d'Alice", auteur: "A", annee: 2001, disponible: false } });
    const other = await ctx.prisma.ouvrage.create({ data: { titre: "Titre de Bob", auteur: "B", annee: 2002, disponible: false } });
    const retourPrevuLe = new Date("2030-01-15");
    await ctx.prisma.emprunt.createMany({
      data: [
        { ouvrageId: mine.id, emprunteurId: ctx.users.alice.id, retourPrevuLe },
        { ouvrageId: other.id, emprunteurId: ctx.users.bob.id, retourPrevuLe },
      ],
    });

    const text = answerText((await ask("alice", "Quels sont mes emprunts ?")).events);
    assert.match(text, /Titre d'Alice/);
    assert.doesNotMatch(text, /Titre de Bob/);
  });

  it("efface la conversation de l'utilisateur", async () => {
    const { status } = await ctx.api("/api/assistant/memoire", { method: "DELETE", token: await tokenFor("alice") });
    assert.equal(status, 204);
  });

  it("limite les questions par compte et répond 429 au-delà", async () => {
    // Bob n'a encore rien demandé : son quota est entier, celui d'Alice ne compte pas.
    for (let count = 1; count <= ASSISTANT_MAX; count += 1) {
      assert.equal((await ask("bob", "Bonjour")).status, 200, `question ${count}`);
    }
    assert.equal((await ask("bob", "Bonjour")).status, 429);
  });
});
