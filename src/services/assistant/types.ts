export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Outil exposé au modèle. L'identité vient de la requête authentifiée, jamais des arguments.
export interface AssistantTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(rawArguments: string): Promise<unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AssistantEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "done"; usage: TokenUsage };

export interface AssistantRequest {
  instructions: string;
  history: ChatMessage[];
  question: string;
  tools: AssistantTool[];
  signal: AbortSignal;
}

// Fournisseur de modèle : OpenAI en production, bouchon en développement et en test.
export interface AssistantProvider {
  readonly name: string;
  stream(request: AssistantRequest): AsyncIterable<AssistantEvent>;
}
