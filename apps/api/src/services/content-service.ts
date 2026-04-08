import type { TranscriptSegment, AITemplate, AIDocument } from "@tab-zen/shared";

export class ContentService {
  constructor(private r2: R2Bucket) {}

  async storeTranscript(syncToken: string, tabId: string, segments: TranscriptSegment[]): Promise<string> {
    const key = `${syncToken}/transcripts/${tabId}.json`;
    await this.r2.put(key, JSON.stringify(segments), {
      httpMetadata: { contentType: "application/json" },
    });
    return `transcripts/${tabId}`;
  }

  async getTranscript(syncToken: string, tabId: string): Promise<TranscriptSegment[] | null> {
    const key = `${syncToken}/transcripts/${tabId}.json`;
    const object = await this.r2.get(key);
    if (!object) return null;
    return object.json();
  }

  async deleteTranscript(syncToken: string, tabId: string): Promise<void> {
    const key = `${syncToken}/transcripts/${tabId}.json`;
    await this.r2.delete(key);
  }

  async storeAIDocuments(syncToken: string, documents: AIDocument[]): Promise<void> {
    const key = `${syncToken}/ai-documents.json`;
    await this.r2.put(key, JSON.stringify(documents), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  async getAIDocuments(syncToken: string): Promise<AIDocument[] | null> {
    const key = `${syncToken}/ai-documents.json`;
    const object = await this.r2.get(key);
    if (!object) return null;
    return object.json();
  }

  async storeAITemplates(syncToken: string, templates: AITemplate[]): Promise<void> {
    const key = `${syncToken}/ai-templates.json`;
    await this.r2.put(key, JSON.stringify(templates), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  async getAITemplates(syncToken: string): Promise<AITemplate[] | null> {
    const key = `${syncToken}/ai-templates.json`;
    const object = await this.r2.get(key);
    if (!object) return null;
    return object.json();
  }
}
