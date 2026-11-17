import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { loadConfig } from "../src/config.ts";
import { createAssistantProvider } from "../src/services/assistant/provider.ts";

const saved = { provider: process.env.IA_FOURNISSEUR, key: process.env.OPENAI_API_KEY };

// Restaure l'environnement modifié par chaque test.
afterEach(() => {
  for (const [name, value] of [["IA_FOURNISSEUR", saved.provider], ["OPENAI_API_KEY", saved.key]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Choix du fournisseur de l'assistant", () => {
  it("refuse de démarrer avec IA_FOURNISSEUR=openai sans clé", () => {
    process.env.IA_FOURNISSEUR = "openai";
    delete process.env.OPENAI_API_KEY;
    assert.throws(() => loadConfig(), /OPENAI_API_KEY/);
  });

  it("refuse une configuration openai sans clé construite à la main", () => {
    process.env.IA_FOURNISSEUR = "bouchon";
    const settings = { ...loadConfig().assistant, provider: "openai" as const, openaiApiKey: undefined };
    assert.throws(() => createAssistantProvider(settings), /OPENAI_API_KEY/);
  });

  it("utilise le bouchon quand il est demandé explicitement", () => {
    process.env.IA_FOURNISSEUR = "bouchon";
    assert.equal(createAssistantProvider(loadConfig().assistant).name, "bouchon");
  });
});
