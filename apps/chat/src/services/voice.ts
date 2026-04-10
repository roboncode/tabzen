const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export async function transcribeAudio(
  apiKey: string,
  audioBlob: Blob,
  model: string = 'whisper-large-v3',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', model);
  formData.append('response_format', 'text');

  const response = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GROQ transcription error (${response.status}): ${error}`);
  }

  return response.text();
}
