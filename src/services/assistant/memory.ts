import type { ChatMessage } from "./types.ts";

export interface ConversationMemory {
  get(userId: number): ChatMessage[];
  append(userId: number, exchange: [ChatMessage, ChatMessage]): void;
  clear(userId: number): void;
}

// Mémoire de conversation par utilisateur, tronquée aux derniers échanges.
// En mémoire du processus : une instance unique suffit ici, une base partagée la remplacerait à plusieurs.
export function createConversationMemory({ maxExchanges }: { maxExchanges: number }): ConversationMemory {
  const conversations = new Map<number, ChatMessage[]>();
  const maxMessages = maxExchanges * 2;

  return {
    get: (userId) => [...(conversations.get(userId) ?? [])],

    append(userId, exchange) {
      const messages = [...(conversations.get(userId) ?? []), ...exchange];
      conversations.set(userId, messages.slice(-maxMessages));
    },

    clear(userId) {
      conversations.delete(userId);
    },
  };
}
