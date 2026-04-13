// apps/extension/lib/chat/chat-voice.ts
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export async function transcribeAudio(
  apiKey: string,
  audioBlob: Blob,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'text');

  const response = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq transcription error (${response.status}): ${error}`);
  }

  return response.text();
}
