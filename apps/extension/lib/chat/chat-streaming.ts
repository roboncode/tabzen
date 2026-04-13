// apps/extension/lib/chat/chat-streaming.ts
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* streamChatCompletion(
  apiKey: string,
  model: string,
  messages: LLMMessage[],
): AsyncGenerator<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tab-zen.app',
      'X-Title': 'Tab Zen Chat',
    },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${error}`);
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
