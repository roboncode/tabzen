// apps/extension/lib/chat/chat-streaming.ts
import { getAiEndpoint } from './ai-client';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* streamChatCompletion(
  messages: LLMMessage[],
  model?: string,
): AsyncGenerator<string> {
  const ep = await getAiEndpoint();
  if (!ep) throw new Error('Chat unavailable: configure the sync worker URL');

  const response = await fetch(`${ep.baseUrl}/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ep.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, model }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat error (${response.status}): ${error}`);
  }

  if (!response.body) throw new Error('Response body is null — streaming not supported');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        /* skip malformed SSE chunks */
      }
    }
  }
}

export interface DocumentChatContext {
  title: string;
  url: string;
  author?: string;
  contentType: 'transcript' | 'article';
  content: string;
}
