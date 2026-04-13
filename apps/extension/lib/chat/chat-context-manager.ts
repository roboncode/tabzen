// apps/extension/lib/chat/chat-context-manager.ts
import type { ChatMessage } from "@tab-zen/shared";
import type { DocumentChatContext } from "./chat-streaming";
import { estimateTokens, getModelByIdOrDefault } from "./chat-models";
import { streamChatCompletion } from "./chat-streaming";

const CONTEXT_BUDGET_RATIO = 0.75;
const COMPACTION_THRESHOLD = 0.70;
const MIN_RECENT_MESSAGES = 4;

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ContextSnapshot {
  systemPromptTokens: number;
  documentTokens: number;
  summaryTokens: number;
  messageTokens: number;
  totalInputTokens: number;
  maxInputTokens: number;
  maxContextTokens: number;
  messagesIncluded: number;
  messagesTotal: number;
  hasBeenCompacted: boolean;
  summary: string | null;
  // Compression info
  isCompressed: boolean;
  originalDocumentTokens: number | null;
  compressionSavings: number | null; // percentage saved, e.g. 0.65 = 65%
  activeSkillCount: number;
  skillTokens: number;
}

export interface PreparedPayload {
  messages: LLMMessage[];
  snapshot: ContextSnapshot;
}

export { MIN_RECENT_MESSAGES };

export function preparePayload(
  documentContext: DocumentChatContext,
  conversationMessages: ChatMessage[],
  existingSummary: string | null,
  modelId: string,
  compressionInfo?: { originalTokens: number; compressedTokens: number },
  skillPrompt?: string,
): PreparedPayload {
  const model = getModelByIdOrDefault(modelId);
  const maxInputTokens = Math.floor(model.maxContextTokens * CONTEXT_BUDGET_RATIO);

  let systemPrompt = buildFullSystemPrompt(documentContext);
  if (skillPrompt) {
    systemPrompt += skillPrompt;
  }
  const systemPromptTokens = estimateTokens(systemPrompt);
  const documentTokens = estimateTokens(documentContext.content);
  const summaryTokens = existingSummary ? estimateTokens(existingSummary) : 0;
  const fixedTokens = systemPromptTokens + summaryTokens;
  const budgetForMessages = maxInputTokens - fixedTokens;

  let messageTokens = 0;
  let startIndex = 0;

  const messageTokenEstimates = conversationMessages.map((m) => estimateTokens(m.content) + 4);
  const totalMessageTokens = messageTokenEstimates.reduce((a, b) => a + b, 0);

  if (totalMessageTokens <= budgetForMessages) {
    messageTokens = totalMessageTokens;
    startIndex = 0;
  } else {
    messageTokens = 0;
    startIndex = conversationMessages.length;
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const tokenCost = messageTokenEstimates[i];
      if (messageTokens + tokenCost > budgetForMessages && startIndex < conversationMessages.length - MIN_RECENT_MESSAGES + 1) {
        break;
      }
      messageTokens += tokenCost;
      startIndex = i;
    }
  }

  const includedMessages = conversationMessages.slice(startIndex);

  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (existingSummary) {
    llmMessages.push({
      role: "system",
      content: `## Previous Conversation Context\n${existingSummary}`,
    });
  }

  for (const msg of includedMessages) {
    llmMessages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  const totalInputTokens = fixedTokens + messageTokens;

  return {
    messages: llmMessages,
    snapshot: {
      systemPromptTokens,
      documentTokens,
      summaryTokens,
      messageTokens,
      totalInputTokens,
      maxInputTokens,
      maxContextTokens: model.maxContextTokens,
      messagesIncluded: includedMessages.length,
      messagesTotal: conversationMessages.length,
      hasBeenCompacted: existingSummary !== null,
      summary: existingSummary,
      // Compression info
      isCompressed: compressionInfo !== undefined,
      originalDocumentTokens: compressionInfo?.originalTokens ?? null,
      compressionSavings: compressionInfo
        ? 1 - (compressionInfo.compressedTokens / compressionInfo.originalTokens)
        : null,
      activeSkillCount: skillPrompt ? skillPrompt.split("---").length : 0,
      skillTokens: skillPrompt ? estimateTokens(skillPrompt) : 0,
    },
  };
}

export function needsCompaction(snapshot: ContextSnapshot): boolean {
  return (
    snapshot.totalInputTokens > snapshot.maxInputTokens * COMPACTION_THRESHOLD &&
    snapshot.messagesTotal > MIN_RECENT_MESSAGES
  );
}

export async function compactConversation(
  apiKey: string,
  modelId: string,
  existingSummary: string | null,
  messagesToCompact: ChatMessage[],
): Promise<string> {
  const messagesText = messagesToCompact
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const prompt = existingSummary
    ? `Update this conversation summary with the new messages below. Preserve all key information, decisions, and context. Be thorough but concise.

## Existing Summary
${existingSummary}

## New Messages
${messagesText}

Write the updated summary:`
    : `Summarize this conversation. Preserve all key information, decisions, questions asked, and conclusions reached. Be thorough but concise.

## Messages
${messagesText}

Write the summary:`;

  let summary = "";
  for await (const chunk of streamChatCompletion(apiKey, modelId, [
    { role: "user", content: prompt },
  ])) {
    summary += chunk;
  }

  return summary.trim();
}

function buildFullSystemPrompt(doc: DocumentChatContext): string {
  return `You are a helpful assistant. The user is viewing a specific document and asking questions about it.

## Document
Title: ${doc.title}
Source: ${doc.url}
Author: ${doc.author || "Unknown"}
Type: ${doc.contentType}

## Content
${doc.content}

Answer questions based on the document content above. If the user asks something not covered in the document, say so. Be concise and reference specific parts of the content when relevant.`;
}
