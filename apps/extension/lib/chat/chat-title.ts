// apps/extension/lib/chat/chat-title.ts
import type { ChatMessage } from '@tab-zen/shared';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateConversationTitle(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string | null> {
  if (messages.length < 2) return null;

  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (firstUserMsg && firstUserMsg.content.trim().length < 10) {
    if (messages.length <= 2) return null;
  }

  const titleMessages = messages.slice(0, 6).map((m) => `${m.role}: ${m.content}`).join('\n');

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tab-zen.app',
      'X-Title': 'Tab Zen Chat',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: `Generate a short title (under 50 characters) for this conversation. Return only the title text, nothing else.\n\n${titleMessages}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 60,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const title = data.choices?.[0]?.message?.content?.trim();
  return title && title.length > 0 && title.length <= 60 ? title : null;
}
