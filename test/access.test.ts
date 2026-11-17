import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type AccountKey, type Json, useTestContext, withTokens } from "./helpers/context.ts";

const tokens: Partial<Record<AccountKey, string>> = {};
const RETURN_DATE = "2030-01-15";

const ctx = useTestContext({}, { onReady: withTokens(tokens) });

// Crée un emprunt pour le compte donné, sur un nouvel ouvrage.
async function borrowAs(account: AccountKey): Promise<Json> {
  const book = await ctx.createBook();
  const { body } = await ctx.api("/api/emprunts", {
    method: "POST",
    token: tokens[account],
    body: { ouvrageId: book.id, retourPrevuLe: RETURN_DATE },
  });
  return body;
}

describe("Autorisation sur le catalogue", () => {
  it("laisse un membre consulter le catalogue", async () => {
    const { status } = await ctx.api("/api/ouvrages", { token: tokens.alice });
    assert.equal(status, 200);
  });

  it("ramène une limite trop grande au plafond de 50 au lieu de la refuser", async () => {
    const { status, body } = await ctx.api("/api/ouvrages?limite=500", { token: tokens.alice });
    assert.equal(status, 200);
    assert.equal(body.limite, 50);
    assert.ok(body.donnees.length <= 50);
  });

  it("refuse toujours une limite nulle ou non numérique", async () => {
    for (const limite of ["0", "abc"]) {
      const { status } = await ctx.api(`/api/ouvrages?limite=${limite}`, { token: tokens.alice });
      assert.equal(status, 400);
    }
  });

  it("refuse la création d'un ouvrage à un membre en 403", async () => {
    const { status } = await ctx.api("/api/ouvrages", {
      method: "POST",
      token: tokens.alice,
      body: { titre: "Interdit", auteur: "Membre", annee: 2000 },
    });
    assert.equal(status, 403);
  });

  it("autorise la gestion du catalogue au bibliothécaire", async () => {
    const created = await ctx.api("/api/ouvrages", {
      method: "POST",
      token: tokens.librarian,
      body: { titre: "Autorisé", auteur: "Bibliothécaire", annee: 2000 },
    });
    assert.equal(created.status, 201);
    const removed = await ctx.api(`/api/ouvrages/${created.body.id}`, { method: "DELETE", token: tokens.librarian });
    assert.equal(removed.status, 204);
  });
});

describe("Autorisation sur les emprunts", () => {
  it("crée l'emprunt d'un membre pour lui-même, même s'il désigne quelqu'un d'autre", async () => {
    const book = await ctx.createBook();
    const { status, body } = await ctx.api("/api/emprunts", {
      method: "POST",
      token: tokens.alice,
      body: { ouvrageId: book.id, emprunteurId: ctx.users.bob.id, retourPrevuLe: RETURN_DATE },
    });
    assert.equal(status, 201);
    assert.equal(body.emprunteurId, ctx.users.alice.id);
  });

  it("ne liste à un membre que ses propres emprunts", async () => {
    await borrowAs("bob");
    const { body } = await ctx.api("/api/emprunts?limite=50", { token: tokens.alice });
    assert.ok(body.total > 0);
    assert.ok(body.donnees.every((loan: Json) => loan.emprunteurId === ctx.users.alice.id));
  });

  it("répond 404 à un membre sur l'emprunt d'un autre, exactement comme pour un emprunt absent", async () => {
    const bobLoan = await borrowAs("bob");
    const read = await ctx.api(`/api/emprunts/${bobLoan.id}`, { token: tokens.alice });
    const update = await ctx.api(`/api/emprunts/${bobLoan.id}`, { method: "PATCH", token: tokens.alice, body: { retourPrevuLe: RETURN_DATE } });
    const close = await ctx.api(`/api/emprunts/${bobLoan.id}/retour`, { method: "POST", token: tokens.alice });
    const missing = await ctx.api("/api/emprunts/999999", { token: tokens.alice });

    for (const response of [read, update, close]) {
      assert.equal(response.status, 404);
      assert.deepEqual(response.body, missing.body);
    }
  });

  it("masque à un membre les emprunts des autres dans le détail d'un ouvrage", async () => {
    const bobLoan = await borrowAs("bob");
    const { body } = await ctx.api(`/api/ouvrages/${bobLoan.ouvrageId}`, { token: tokens.alice });
    assert.deepEqual(body.emprunts, []);
  });

  it("laisse un membre clôturer son propre emprunt", async () => {
    const loan = await borrowAs("alice");
    const { status, body } = await ctx.api(`/api/emprunts/${loan.id}/retour`, { method: "POST", token: tokens.alice });
    assert.equal(status, 200);
    assert.equal(body.rendu, true);
  });

  it("ne permet pas de changer le propriétaire d'un emprunt par PATCH", async () => {
    const loan = await borrowAs("alice");
    const { status, body } = await ctx.api(`/api/emprunts/${loan.id}`, {
      method: "PATCH",
      token: tokens.alice,
      body: { emprunteurId: ctx.users.bob.id, retourPrevuLe: "2030-02-01" },
    });
    assert.equal(status, 200);
    assert.equal(body.emprunteurId, ctx.users.alice.id);
  });

  it("donne au bibliothécaire la vue et la clôture de tous les emprunts", async () => {
    const bobLoan = await borrowAs("bob");
    const list = await ctx.api("/api/emprunts?limite=50", { token: tokens.librarian });
    assert.ok(list.body.donnees.some((loan: Json) => loan.emprunteurId === ctx.users.bob.id));
    const close = await ctx.api(`/api/emprunts/${bobLoan.id}/retour`, { method: "POST", token: tokens.librarian });
    assert.equal(close.status, 200);
  });

  it("réserve la suppression d'un emprunt au bibliothécaire", async () => {
    const loan = await borrowAs("alice");
    const asMember = await ctx.api(`/api/emprunts/${loan.id}`, { method: "DELETE", token: tokens.alice });
    assert.equal(asMember.status, 403);
  });
});
