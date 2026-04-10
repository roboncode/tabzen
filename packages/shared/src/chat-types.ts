// --- Adapter Interface ---
export interface ChatDataAdapter {
  storeDocumentContext(context: DocumentContext): Promise<void>;
  storeChunks(documentId: string, chunks: Chunk[]): Promise<void>;
  searchSimilar(embedding: number[], topK: number, filters?: SearchFilters): Promise<ChunkResult[]>;
  getDocumentContext(documentId: string): Promise<DocumentContext>;
  saveConversation(conversation: Conversation): Promise<void>;
  getConversation(conversationId: string): Promise<Conversation>;
  listConversations(): Promise<ConversationSummary[]>;
  deleteConversation(conversationId: string): Promise<void>;
  generateEmbedding(text: string): Promise<number[]>;
}

// --- Document & Chunks ---
export interface DocumentContext {
  documentId: string;
  userId?: string;
  teamId?: string;
  title: string;
  url: string;
  author?: string;
  capturedAt: string;
  contentType: 'transcript' | 'markdown';
  framingContent: string;
  metadata?: Record<string, string>;
}

export interface Chunk {
  chunkId: string;
  documentId: string;
  text: string;
  embedding: number[];
  position: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  timestampStart?: string;
  timestampEnd?: string;
  sectionHeading?: string;
  speaker?: string;
}

export interface ChunkResult {
  chunk: Chunk;
  context: DocumentContext;
  score: number;
}

// --- Conversations ---
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  modelId?: string;
  createdAt: string;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  title: string;
  snippet: string;
  url: string;
  timestamp?: string;
}

export interface Conversation {
  id: string;
  userId?: string;
  teamId?: string;
  title: string;
  groupId?: string;
  scope: ConversationScope;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationGroup {
  id: string;
  userId?: string;
  teamId?: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  groupId?: string;
  scope: ConversationScope;
  messageCount: number;
  lastMessageAt: string;
  updatedAt: string;
}

export interface ConversationScope {
  type: 'document' | 'collection';
  documentId?: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  tags?: string[];
  authors?: string[];
  contentType?: 'transcript' | 'markdown';
  dateRange?: { from: string; to: string };
}

// --- Configuration ---
export interface ChatConfig {
  models: ModelOption[];
  defaultModelId: string;
  showModelSwitcher?: boolean;
  voiceEnabled: boolean;
  onVoiceRecord?: (audio: Blob) => Promise<string>;
  onSendMessage: (message: string, modelId: string) => void;
  onStreamResponse: () => AsyncIterable<string>;
  onFeedback?: (messageId: string, helpful: boolean) => void;
  onCheckpointRestore?: (messageId: string) => void;
  contextInfo?: ContextInfo;
  theme?: 'dark' | 'light';
}

export interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

export interface ContextInfo {
  usedTokens: number;
  maxTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheTokens?: number;
  estimatedCost?: number;
}
