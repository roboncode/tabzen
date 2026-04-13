// apps/extension/lib/chat/chat-models.ts
import type { ModelOption } from "@tab-zen/shared";

export interface ChatModel extends ModelOption {
  maxContextTokens: number;
}

export const CHAT_MODELS: ChatModel[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", maxContextTokens: 128000 },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", maxContextTokens: 128000 },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", maxContextTokens: 200000 },
  { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4", provider: "Anthropic", maxContextTokens: 200000 },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", maxContextTokens: 1000000 },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", maxContextTokens: 1000000 },
];

export function getModelByIdOrDefault(modelId: string): ChatModel {
  return CHAT_MODELS.find((m) => m.id === modelId) ?? CHAT_MODELS[0];
}

/**
 * Approximate token count from text.
 * Uses ~3.5 chars per token heuristic. Overestimates slightly which is safer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
