import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { AuthUser } from "../domain/types.ts";
import { unauthorized } from "../erreurs.ts";

const ALGORITHM = "HS256";
const ISSUER = "mediatheque-api";
const ROLES = new Set(["membre", "bibliothecaire"]);

export interface TokenSettings {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
}

export interface RefreshTokenDraft {
  token: string;
  fingerprint: string;
  expiresAt: Date;
}

export interface TokenService {
  readonly accessTtlSeconds: number;
  signAccessToken(user: AuthUser): Promise<string>;
  verifyAccessToken(token: string): Promise<AuthUser>;
  createRefreshToken(): RefreshTokenDraft;
}

// Empreinte stockée en base : un vol de la table ne livre aucun jeton utilisable.
export const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");

// Access token JWT court, refresh token opaque et aléatoire.
export function createTokenService({ accessSecret, accessTtlSeconds, refreshTtlDays }: TokenSettings): TokenService {
  const key = new TextEncoder().encode(accessSecret);

  return {
    accessTtlSeconds,

    // Le jeton ne porte que l'identifiant et le rôle, jamais de donnée sensible.
    signAccessToken: (user) =>
      new SignJWT({ role: user.role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(String(user.id))
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${accessTtlSeconds}s`)
        .sign(key),

    async verifyAccessToken(token) {
      const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM], issuer: ISSUER });
      const id = Number(payload.sub);
      const role = payload.role;
      // Un jeton bien signé mais au contenu inattendu reste refusé.
      if (!Number.isInteger(id) || typeof role !== "string" || !ROLES.has(role)) {
        throw unauthorized("Jeton invalide ou expiré");
      }
      return { id, role: role as AuthUser["role"] };
    },

    createRefreshToken() {
      const token = randomBytes(48).toString("base64url");
      const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
      return { token, fingerprint: fingerprint(token), expiresAt };
    },
  };
}
