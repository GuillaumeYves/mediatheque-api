import { z } from "zod";

// bcrypt ignore tout ce qui dépasse 72 octets : on refuse au-delà.
const MAX_PASSWORD_BYTES = 72;

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

const fitsBcrypt = (value: string) => Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES;

export const registerSchema = z
  .object({
    email: emailSchema,
    motDePasse: z.string().min(12).refine(fitsBcrypt, "Mot de passe trop long (72 octets au plus)"),
  })
  .meta({ id: "Inscription" });

// À la connexion, aucune règle de complexité n'est rappelée : on ne guide pas un attaquant.
export const loginSchema = z
  .object({
    email: emailSchema,
    motDePasse: z.string().min(1).max(200),
  })
  .meta({ id: "Connexion" });

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).max(200),
  })
  .meta({ id: "Rafraichissement" });

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
export type RefreshInput = z.output<typeof refreshSchema>;
