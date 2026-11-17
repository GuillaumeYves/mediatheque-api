import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type AccountKey, type Json, useTestContext, withTokens } from "./helpers/context.ts";

const tokens: Partial<Record<AccountKey, string>> = {};
const ctx = useTestContext({}, { onReady: withTokens(tokens) });

const post = (path: string, account: AccountKey, body?: unknown) =>
  ctx.api(path, { method: "POST", token: tokens[account], body });

// Un ouvrage emprunté par le compte donné : il devient réservable.
async function borrowedBook(account: AccountKey): Promise<{ bookId: number; loan: Json }> {
  const book = await ctx.createBook();
  const { body } = await post("/api/emprunts", account, { ouvrageId: book.id, retourPrevuLe: "2030-01-15" });
  return { bookId: book.id, loan: body };
}

const reserve = (account: AccountKey, ouvrageId: number, extra: object = {}) =>
  post("/api/reservations", account, { ouvrageId, ...extra });

describe("Réservations", () => {
  it("réserve un ouvrage indisponible pour le membre lui-même", async () => {
    const { bookId } = await borrowedBook("alice");
    const { status, body } = await reserve("bob", bookId, { membreId: ctx.users.alice.id });
    assert.equal(status, 201);
    assert.equal(body.statut, "active");
    assert.equal(body.membreId, ctx.users.bob.id, "un membre ne réserve pas pour un autre");
  });

  it("refuse de réserver un ouvrage disponible en 409", async () => {
    const book = await ctx.createBook();
    const { status } = await reserve("bob", book.id);
    assert.equal(status, 409);
  });

  it("refuse une réservation sur un ouvrage que le membre emprunte déjà en 409", async () => {
    const { bookId } = await borrowedBook("alice");
    const { status } = await reserve("alice", bookId);
    assert.equal(status, 409);
  });

  it("n'accepte qu'une réservation active par membre, même sous requêtes simultanées", async () => {
    const { bookId } = await borrowedBook("alice");
    const results = await Promise.all(Array.from({ length: 4 }, () => reserve("bob", bookId)));
    const statuses = results.map(({ status }) => status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409]);
  });

  it("passe l'ouvrage rendu à la plus ancienne réservation active", async () => {
    const { bookId, loan } = await borrowedBook("alice");
    const first = await reserve("bob", bookId);
    await reserve("librarian", bookId);

    const { status, body } = await post(`/api/emprunts/${loan.id}/retour`, "alice");
    assert.equal(status, 200);
    assert.equal(body.rendu, true);
    assert.equal(body.empruntSuivant.emprunteurId, ctx.users.bob.id);

    const reservation = await ctx.api(`/api/reservations/${first.body.id}`, { token: tokens.bob });
    assert.equal(reservation.body.statut, "honoree");
    assert.equal(reservation.body.empruntId, body.empruntSuivant.id);

    const book = await ctx.prisma.ouvrage.findUnique({ where: { id: bookId } });
    assert.equal(book?.disponible, false, "l'ouvrage reste indisponible : il est reparti");
  });

  it("rend l'ouvrage disponible quand personne ne l'attend", async () => {
    const { bookId, loan } = await borrowedBook("alice");
    const { body } = await post(`/api/emprunts/${loan.id}/retour`, "alice");
    assert.equal(body.empruntSuivant, null);
    const book = await ctx.prisma.ouvrage.findUnique({ where: { id: bookId } });
    assert.equal(book?.disponible, true);
  });

  it("laisse annuler sa réservation, une seule fois, et saute les annulées dans la file", async () => {
    const { bookId, loan } = await borrowedBook("alice");
    const cancelled = await reserve("bob", bookId);

    const first = await ctx.api(`/api/reservations/${cancelled.body.id}`, { method: "DELETE", token: tokens.bob });
    const second = await ctx.api(`/api/reservations/${cancelled.body.id}`, { method: "DELETE", token: tokens.bob });
    assert.equal(first.status, 204);
    assert.equal(second.status, 409);

    const { body } = await post(`/api/emprunts/${loan.id}/retour`, "alice");
    assert.equal(body.empruntSuivant, null, "une réservation annulée ne reçoit pas l'ouvrage");
  });

  it("masque en 404 les réservations des autres membres et filtre la liste", async () => {
    const { bookId } = await borrowedBook("librarian");
    const bobReservation = await reserve("bob", bookId);

    const read = await ctx.api(`/api/reservations/${bobReservation.body.id}`, { token: tokens.alice });
    const cancel = await ctx.api(`/api/reservations/${bobReservation.body.id}`, { method: "DELETE", token: tokens.alice });
    const missing = await ctx.api("/api/reservations/999999", { token: tokens.alice });
    for (const response of [read, cancel]) {
      assert.equal(response.status, 404);
      assert.deepEqual(response.body, missing.body);
    }

    const list = await ctx.api("/api/reservations?limite=50", { token: tokens.alice });
    assert.ok(list.body.donnees.every((item: Json) => item.membreId === ctx.users.alice.id));

    const all = await ctx.api("/api/reservations?limite=50", { token: tokens.librarian });
    assert.ok(all.body.donnees.some((item: Json) => item.membreId === ctx.users.bob.id));
  });
});
