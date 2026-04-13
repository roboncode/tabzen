// apps/extension/lib/chat/chat-compress.ts
import { streamChatCompletion } from "./chat-streaming";
import { estimateTokens } from "./chat-models";
import { ChatAdapter } from "./chat-adapter";
import type { CompressedContent } from "./chat-db";
import compressPromptRaw from "@/prompts/content-compress.md?raw";

const adapter = new ChatAdapter();

export interface CompressionResult {
  compressed: CompressedContent;
  isNew: boolean;
}

/**
 * Gets or creates compressed content for a page.
 * Returns cached version if available, otherwise compresses and stores.
 */
export async function getOrCompressContent(
  pageId: string,
  originalContent: string,
  apiKey: string,
  modelId: string,
  onProgress?: (status: string) => void,
): Promise<CompressionResult> {
  // Check cache first
  const existing = await adapter.getCompressedContent(pageId);
  if (existing) {
    return { compressed: existing, isNew: false };
  }

  // Compress
  onProgress?.("Compressing content for chat...");

  const prompt = compressPromptRaw.replace("{{content}}", originalContent);
  let compressedText = "";

  for await (const chunk of streamChatCompletion(apiKey, modelId, [
    { role: "user", content: prompt },
  ])) {
    compressedText += chunk;
  }

  compressedText = compressedText.trim();

  const originalTokens = estimateTokens(originalContent);
  const compressedTokens = estimateTokens(compressedText);

  const compressed: CompressedContent = {
    pageId,
    originalTokens,
    compressedTokens,
    compressedText,
    modelUsed: modelId,
    createdAt: new Date().toISOString(),
  };

  await adapter.saveCompressedContent(compressed);
  onProgress?.("");

  return { compressed, isNew: true };
}

/**
 * Invalidates cached compressed content for a page.
 * Call when the original content changes.
 */
export async function invalidateCompressedContent(pageId: string): Promise<void> {
  await adapter.deleteCompressedContent(pageId);
}
