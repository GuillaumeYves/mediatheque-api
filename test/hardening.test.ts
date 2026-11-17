import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { useTestContext } from "./helpers/context.ts";

// Application dédiée avec la limite réelle de 10 tentatives sur /api/auth.
const ctx = useTestContext({ corsOrigins: ["https://app.example.net"], rateLimit: { authMax: 10 } });

describe("Durcissement", () => {
  it("pose les en-têtes de sécurité et masque la technologie", async () => {
    const { headers } = await ctx.api("/sante");
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.ok(headers.get("content-security-policy"));
    assert.equal(headers.get("x-powered-by"), null);
  });

  it("accepte une origine déclarée et refuse les autres en 403", async () => {
    const allowed = await ctx.api("/sante", { headers: { Origin: "https://app.example.net" } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://app.example.net");

    const refused = await ctx.api("/sante", { headers: { Origin: "https://pirate.example.net" } });
    assert.equal(refused.status, 403);
    assert.equal(refused.headers.get("access-control-allow-origin"), null);
  });

  // Hors de /api/auth pour ne pas consommer le quota testé plus bas.
  it("refuse un corps JSON de plus de 100 Ko en 413", async () => {
    const { status } = await ctx.api("/api/ouvrages", { method: "POST", body: { titre: "x".repeat(150 * 1024) } });
    assert.equal(status, 413);
  });

  it("répond sans pile d'exécution sur un JSON mal formé", async () => {
    const { status, body } = await ctx.api("/api/ouvrages", { method: "POST", body: "{ mal formé" });
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(body), ["erreur"]);
  });

  it("bloque la onzième tentative de connexion en 429", async () => {
    const attempt = () =>
      ctx.api("/api/auth/connexion", {
        method: "POST",
        body: { email: "alice@example.net", motDePasse: "mauvais-mot-de-passe" },
      });

    for (let count = 1; count <= 10; count += 1) {
      assert.equal((await attempt()).status, 401, `tentative ${count}`);
    }
    const eleventh = await attempt();
    assert.equal(eleventh.status, 429);
    assert.equal(eleventh.headers.get("ratelimit-remaining"), "0");
  });
});
