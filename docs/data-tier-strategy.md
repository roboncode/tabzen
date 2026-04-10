# Tab Zen -- Data Tier Strategy

Describes the three-tier data architecture that Tab Zen will evolve toward. This strategy affects storage, sync, vector search, and the commercial model.

---

## Current Architecture (M1-M5)

| Concern | Technology | Notes |
|---------|-----------|-------|
| Local structured data | IndexedDB (`tab-zen` v3) | Tabs, groups, captures, AI templates, AI documents |
| Content blobs | Cloudflare R2 | Transcripts, extracted markdown |
| Sync metadata | Cloudflare D1 | Push/pull sync via Cloudflare Worker API |
| AI generation | OpenRouter | GPT-4o-mini default, configurable model |

Sync flow: IndexedDB <-> Cloudflare Worker API <-> D1 (metadata) + R2 (content)

---

## Target Architecture: Three Tiers

### Tier 1: Free (Default)

**No server required. Everything runs locally.**

| Concern | Technology |
|---------|-----------|
| Structured data | IndexedDB |
| Content storage | IndexedDB |
| Embeddings | transformers.js (in-browser, Web Worker) |
| Vector storage | IndexedDB (stored as arrays, cosine similarity search) |
| Chat history | IndexedDB |
| Sync | None (single device) |

- Zero cost to the developer (us)
- Zero cost to the user
- Works offline
- Suitable for personal use with a reasonable number of tabs (hundreds to low thousands)
- Small embedding model (~23MB, e.g., `all-MiniLM-L6-v2` via transformers.js)

### Tier 2: Bring Your Own Database (Turso)

**User provides their own Turso database credentials in settings.**

| Concern | Technology |
|---------|-----------|
| Structured data | Local IndexedDB + Turso sync |
| Content storage | Turso |
| Embeddings | Turso-side or local (configurable) |
| Vector storage | Turso native vector search (`F32_BLOB` + `vector_top_k()`) |
| Chat history | Turso |
| Sync | Turso embedded replicas (local file syncs to remote primary) |

- Zero cost to us
- User pays for their own Turso instance (free tier available)
- Cross-device sync via Turso replication
- Better embedding quality possible (server-side models)
- User can choose local-only vectors with Turso sync for other data, or full Turso vectors
- Browser uses Turso HTTP client (no WASM); desktop/mobile apps can use embedded replicas

**Important browser limitation:** libsql has no WASM build. In the Chrome extension, Turso is accessed via HTTP client only (remote queries). Desktop and mobile apps can use embedded replicas (local file + sync). This means:
- Extension: vectors are either local (IndexedDB) or remote (Turso HTTP), not both simultaneously
- Desktop/mobile: true embedded replicas with local-speed reads

Users can configure whether to:
- Keep local vectors + use Turso for sync only
- Use Turso for everything (requires network for vector search)

### Tier 3: Subscribe (Managed)

**We provide a fully managed backend. User subscribes.**

| Concern | Technology |
|---------|-----------|
| Structured data | Managed Postgres (e.g., Neon) |
| Content storage | Postgres (or R2 for large blobs) |
| Embeddings | Server-side generation (dedicated embedding API) |
| Vector storage | pgvector |
| Chat history | Postgres |
| Sync | Full managed sync across all devices |

- We host and manage the infrastructure
- User pays a subscription fee
- Batteries-included: no configuration needed
- Best embedding quality (server-side models, larger dimensions)
- Full multi-device sync
- Could include additional features (shared knowledge bases, team features, etc.)

---

## Migration Path

```
Tier 1 (Free/Local)
  |
  |-- User adds Turso credentials in Settings
  v
Tier 2 (BYOD/Turso)
  |
  |-- User subscribes
  v
Tier 3 (Managed/Postgres)
```

Each upgrade should be non-destructive:
- Tier 1 -> 2: Local data migrates to Turso, local copy retained as cache
- Tier 2 -> 3: Turso data migrates to managed Postgres
- Downgrade: Local IndexedDB always has a usable copy

---

## Adapter Interface

All tiers are accessed through a common data layer interface. The chat UI and application logic never know which tier is active.

```
ChatDataAdapter
  ├── storeChunks(documentId, chunks[])
  ├── storeDocumentContext(documentId, context)
  ├── searchSimilar(queryEmbedding, topK, filters?) -> Chunk[]
  ├── getDocumentContext(documentId) -> DocumentContext
  ├── saveConversation(conversation)
  ├── getConversation(conversationId) -> Conversation
  ├── listConversations() -> Conversation[]
  └── generateEmbedding(text) -> number[]
```

Implementations:
- `LocalAdapter` — IndexedDB + transformers.js (Tier 1)
- `TursoAdapter` — Turso HTTP client (Tier 2)
- `ManagedAdapter` — API calls to managed backend (Tier 3)

---

## Impact on Existing Sync

The current Cloudflare Worker sync (D1 + R2) continues to work for existing features (tab sync, content storage) until a full migration milestone replaces it. The tier system initially only applies to:
- Chat history
- Embeddings and vector search
- Knowledge base chunked content

A future milestone will consolidate all sync under the chosen tier, at which point D1 and R2 usage would be deprecated in favor of the database tier. This is a separate effort from M8.

---

## Implementation Order

1. **M8 (Knowledge Base & Chat)** — Build with Tier 1 (local only). Establish the adapter interface.
2. **Future milestone** — Add Tier 2 (Turso adapter). Settings UI for credentials.
3. **Future milestone** — Add Tier 3 (managed backend). Subscription billing integration.
4. **Future milestone** — Migrate existing sync (tabs, content, AI docs) from D1/R2 to the active tier. Deprecate Cloudflare Worker sync.
