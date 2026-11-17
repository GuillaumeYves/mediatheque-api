import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import { PASSWORD, useTestContext } from "./helpers/context.ts";

const ctx = useTestContext();

describe("Authentification", () => {
  it("inscrit un membre sans jamais renvoyer le mot de passe ni son empreinte", async () => {
    const { status, body } = await ctx.api("/api/auth/inscription", {
      method: "POST",
      body: { email: "Nouveau@Example.net", motDePasse: PASSWORD, role: "bibliothecaire" },
    });
    assert.equal(status, 201);
    assert.equal(body.email, "nouveau@example.net");
    assert.equal(body.role, "membre", "le rôle envoyé par le client est ignoré");
    assert.equal(body.motDePasseHache, undefined);
    assert.equal(body.motDePasse, undefined);

    const stored = await ctx.prisma.utilisateur.findUnique({ where: { email: "nouveau@example.net" } });
    assert.match(stored?.motDePasseHache ?? "", /^\$2b\$12\$/, "bcrypt avec un coût de 12");
  });

  it("refuse une inscription avec un e-mail déjà utilisé en 409", async () => {
    const { status } = await ctx.api("/api/auth/inscription", {
      method: "POST",
      body: { email: "alice@example.net", motDePasse: PASSWORD },
    });
    assert.equal(status, 409);
  });

  it("refuse un mot de passe trop court en 400", async () => {
    const { status, body } = await ctx.api("/api/auth/inscription", {
      method: "POST",
      body: { email: "court@example.net", motDePasse: "court" },
    });
    assert.equal(status, 400);
    assert.equal(body.details[0].champ, "body.motDePasse");
  });

  it("connecte un compte et renvoie un access token et un refresh token", async () => {
    const body = await ctx.login("alice");
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.equal(body.tokenType, "Bearer");
    assert.ok(body.expiresIn <= 900);
    assert.equal(body.utilisateur.motDePasseHache, undefined);
  });

  it("renvoie le même 401 que le compte existe ou non", async () => {
    const wrongPassword = await ctx.api("/api/auth/connexion", {
      method: "POST",
      body: { email: "alice@example.net", motDePasse: "mauvais-mot-de-passe" },
    });
    const unknownAccount = await ctx.api("/api/auth/connexion", {
      method: "POST",
      body: { email: "personne@example.net", motDePasse: "mauvais-mot-de-passe" },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownAccount.status, 401);
    assert.deepEqual(wrongPassword.body, unknownAccount.body);
  });

  it("refuse l'accès sans jeton en 401", async () => {
    const { status } = await ctx.api("/api/ouvrages");
    assert.equal(status, 401);
  });

  it("refuse un jeton signé par un autre secret en 401", async () => {
    const forged = await new SignJWT({ role: "bibliothecaire" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(ctx.users.alice.id))
      .setIssuer("mediatheque-api")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("un-autre-secret-de-plus-de-trente-deux-caracteres"));
    const { status } = await ctx.api("/api/ouvrages", { token: forged });
    assert.equal(status, 401);
  });

  it("rafraîchit la session avec rotation du refresh token", async () => {
    const { refreshToken } = await ctx.login("bob");
    const first = await ctx.api("/api/auth/rafraichir", { method: "POST", body: { refreshToken } });
    assert.equal(first.status, 200);
    assert.ok(first.body.accessToken);
    assert.notEqual(first.body.refreshToken, refreshToken);

    const me = await ctx.api("/api/auth/moi", { token: first.body.accessToken });
    assert.equal(me.body.email, "bob@example.net");
  });

  it("coupe toute la session quand un refresh token révoqué est rejoué", async () => {
    const { refreshToken } = await ctx.login("bob");
    const rotated = await ctx.api("/api/auth/rafraichir", { method: "POST", body: { refreshToken } });

    const replay = await ctx.api("/api/auth/rafraichir", { method: "POST", body: { refreshToken } });
    assert.equal(replay.status, 401);

    const afterTheft = await ctx.api("/api/auth/rafraichir", {
      method: "POST",
      body: { refreshToken: rotated.body.refreshToken },
    });
    assert.equal(afterTheft.status, 401, "le jeton légitime issu de la rotation est aussi révoqué");
  });

  it("révoque les refresh tokens à la déconnexion", async () => {
    const { accessToken, refreshToken } = await ctx.login("alice");
    const logout = await ctx.api("/api/auth/deconnexion", { method: "POST", token: accessToken });
    assert.equal(logout.status, 204);

    const { status } = await ctx.api("/api/auth/rafraichir", { method: "POST", body: { refreshToken } });
    assert.equal(status, 401);
  });
});
