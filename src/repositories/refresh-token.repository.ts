import type { Db } from "../db/prisma.ts";

export interface NewRefreshToken {
  fingerprint: string;
  userId: number;
  expiresAt: Date;
}

// Accès aux refresh tokens, identifiés par leur empreinte SHA-256.
export function createRefreshTokenRepository(db: Db) {
  return {
    create: ({ fingerprint, userId, expiresAt }: NewRefreshToken) =>
      db.refreshToken.create({ data: { empreinte: fingerprint, utilisateurId: userId, expireLe: expiresAt } }),

    findByFingerprint: (fingerprint: string) =>
      db.refreshToken.findUnique({
        where: { empreinte: fingerprint },
        include: { utilisateur: { select: { id: true, role: true } } },
      }),

    // Révocation conditionnelle : false si le jeton était déjà révoqué entre-temps.
    async revokeIfActive(id: number) {
      const { count } = await db.refreshToken.updateMany({
        where: { id, revoqueLe: null },
        data: { revoqueLe: new Date() },
      });
      return count === 1;
    },

    revokeAllForUser: (userId: number) =>
      db.refreshToken.updateMany({
        where: { utilisateurId: userId, revoqueLe: null },
        data: { revoqueLe: new Date() },
      }),
  };
}

export type RefreshTokenRepository = ReturnType<typeof createRefreshTokenRepository>;
