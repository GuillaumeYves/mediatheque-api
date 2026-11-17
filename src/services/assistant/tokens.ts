import type { ChatMessage } from "./types.ts";

// Estimation sans tokenizer : environ un jeton pour quatre caractères.
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

// Jetons d'entrée envoyés au modèle : instructions, historique et question.
export function estimateInputTokens(instructions: string, history: ChatMessage[], question: string): number {
  return estimateTokens(instructions) + history.reduce((sum, message) => sum + estimateTokens(message.content), 0) + estimateTokens(question);
}
