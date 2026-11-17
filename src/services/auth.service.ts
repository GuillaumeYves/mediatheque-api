import { ROLES } from "../domain/roles.ts";
import type { AuthUser } from "../domain/types.ts";
import { conflict, notFound, prismaErrorCode, unauthorized } from "../erreurs.ts";
import type { DataAccess } from "../repositories/index.ts";
import type { RefreshTokenRepository } from "../repositories/refresh-token.repository.ts";
import type { LoginInput, RefreshInput, RegisterInput } from "../schemas/auth.schema.ts";
import type { PasswordHasher } from "../security/password.ts";
import { fingerprint, type TokenService } from "../security/tokens.ts";

// Même message que le compte existe ou non.
const invalidCredentials = () => unauthorized("Identifiants invalides");
const invalidRefreshToken = () => unauthorized("Refresh token invalide ou expiré");

interface AuthDependencies {
  dataAccess: DataAccess;
  passwordHasher: PasswordHasher;
  tokenService: TokenService;
}

// Inscription, connexion, rotation des refresh tokens et déconnexion.
export function createAuthService({ dataAccess, passwordHasher, tokenService }: AuthDependencies) {
  const { repositories, transaction } = dataAccess;

  // Émet une paire de jetons et enregistre l'empreinte du refresh token.
  async function issueTokens(user: AuthUser, refreshTokens: RefreshTokenRepository = repositories.refreshTokens) {
    const refresh = tokenService.createRefreshToken();
    await refreshTokens.create({ fingerprint: refresh.fingerprint, userId: user.id, expiresAt: refresh.expiresAt });
    return {
      accessToken: await tokenService.signAccessToken(user),
      refreshToken: refresh.token,
      tokenType: "Bearer" as const,
      expiresIn: tokenService.accessTtlSeconds,
    };
  }

  return {
    // Toute inscription publique crée un membre : le rôle n'est pas choisi par le client.
    async register({ email, motDePasse }: RegisterInput) {
      const motDePasseHache = await passwordHasher.hash(motDePasse);
      try {
        return await repositories.users.create({ email, motDePasseHache, role: ROLES.MEMBER });
      } catch (error) {
        if (prismaErrorCode(error) === "P2002") throw conflict("Un compte existe déjà avec cet e-mail");
        throw error;
      }
    },

    async login({ email, motDePasse }: LoginInput) {
      const account = await repositories.users.findCredentialsByEmail(email);
      const valid = await passwordHasher.verify(motDePasse, account?.motDePasseHache);
      if (!account || !valid) throw invalidCredentials();

      const user = { id: account.id, email: account.email, role: account.role };
      return { ...(await issueTokens(user)), utilisateur: user };
    },

    // Rotation : l'ancien refresh token est révoqué, un nouveau est émis.
    // Un jeton déjà révoqué qui revient signale un vol : toute la session est coupée.
    async refresh({ refreshToken }: RefreshInput) {
      const stored = await repositories.refreshTokens.findByFingerprint(fingerprint(refreshToken));
      if (!stored) throw invalidRefreshToken();

      // Hors transaction : la révocation générale doit survivre à l'erreur levée ensuite.
      if (stored.revoqueLe) {
        await repositories.refreshTokens.revokeAllForUser(stored.utilisateurId);
        throw invalidRefreshToken();
      }
      if (stored.expireLe <= new Date()) throw invalidRefreshToken();

      return transaction(async ({ refreshTokens }) => {
        // Deux rafraîchissements simultanés : un seul obtient la révocation.
        if (!(await refreshTokens.revokeIfActive(stored.id))) throw invalidRefreshToken();
        return issueTokens(stored.utilisateur, refreshTokens);
      });
    },

    logout: async (userId: number) => {
      await repositories.refreshTokens.revokeAllForUser(userId);
    },

    async me(userId: number) {
      const user = await repositories.users.findById(userId);
      if (!user) throw notFound("Compte introuvable");
      return user;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
