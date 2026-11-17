import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type Json, useTestContext } from "./helpers/context.ts";

const ctx = useTestContext();

const PUBLIC_OPERATIONS = new Set([
  "get /sante",
  "post /api/auth/inscription",
  "post /api/auth/connexion",
  "post /api/auth/rafraichir",
]);

describe("Documentation OpenAPI", () => {
  it("publie une spécification 3.1 qui couvre toutes les ressources", async () => {
    const { status, body } = await ctx.api("/api/docs.json");
    assert.equal(status, 200);
    assert.equal(body.openapi, "3.1.0");
    for (const path of ["/api/ouvrages/{id}", "/api/emprunts/{id}/retour", "/api/reservations", "/api/assistant/flux"]) {
      assert.ok(body.paths[path], `chemin documenté : ${path}`);
    }
    assert.ok(body.components.schemas.Ouvrage);
    assert.ok(body.components.schemas.Erreur);
  });

  it("déclare le jeton Bearer sur chaque opération protégée, et seulement sur elles", async () => {
    const { body } = await ctx.api("/api/docs.json");
    for (const [path, operations] of Object.entries<Json>(body.paths)) {
      for (const [method, operation] of Object.entries<Json>(operations)) {
        const secured = Array.isArray(operation.security) && operation.security.length > 0;
        assert.equal(secured, !PUBLIC_OPERATIONS.has(`${method} ${path}`), `${method.toUpperCase()} ${path}`);
      }
    }
  });

  it("sert l'interface Swagger UI", async () => {
    const { status, body } = await ctx.api("/api/docs/");
    assert.equal(status, 200);
    assert.match(body, /swagger-ui/);
  });
});
