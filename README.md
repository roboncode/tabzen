# Tab Zen

AI-powered browser tab organization and management. Capture, group, search, and organize your open tabs into a persistent, searchable collection.

## Features

- **Capture tabs** -- Save all open tabs or individual tabs with one click
- **AI grouping** -- Tabs are automatically organized into meaningful groups via OpenRouter (GPT-4o-mini default)
- **Side panel + full page** -- Browse your collection in Chrome's side panel or a dedicated full page view
- **Card and list views** -- YouTube-style card layout or compact row view
- **Search** -- Full-text search across titles, URLs, descriptions, and notes. Press Enter for AI-powered natural language search
- **Notes** -- Add searchable notes to any tab. Dedicated notes view with note-first layout
- **Starring** -- Star important tabs for quick access
- **Archive** -- Archive tabs to declutter without deleting
- **OG metadata** -- Captures Open Graph images, titles, and descriptions for rich social-media-style cards
- **Duplicate detection** -- Prevents saving the same URL twice
- **Export/Import** -- JSON (full fidelity) or HTML bookmarks (universal)
- **Cross-browser sync** -- Optional Cloudflare Workers sync service with token-based auth
- **Keyboard shortcuts** -- `Cmd+Shift+Z` (side panel), `Cmd+Shift+S` (capture all)
- **Context menu** -- Right-click any page to save it

## Tech Stack

- **Extension**: [WXT](https://wxt.dev) + [SolidJS](https://solidjs.com) + [Tailwind CSS](https://tailwindcss.com)
- **Icons**: [Lucide](https://lucide.dev)
- **Storage**: IndexedDB ([idb](https://github.com/nicolo-ribaudo/idb)) + chrome.storage.local
- **AI**: [OpenRouter](https://openrouter.ai)
- **Sync**: Cloudflare Workers + D1 + KV + [Hono](https://hono.dev)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Chrome](https://www.google.com/chrome/) (or Chromium-based browser)

### Install Dependencies

```bash
bun install
```

### Development

```bash
bun run dev
```

This starts WXT in dev mode with hot module replacement. The extension is automatically loaded in a new Chrome window.

### Build for Production

```bash
bun run build
```

Output goes to `.output/chrome-mv3/`. Load this folder as an unpacked extension:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `.output/chrome-mv3/`

### Run Tests

```bash
bun run test          # single run
bun run test:watch    # watch mode
```

## Project Structure

```
tab-zen/
├── entrypoints/
│   ├── popup/           # Quick-action popup (capture, save, open views)
│   ├── sidepanel/       # Side panel UI
│   ├── tabs/            # Full page UI
│   ├── background.ts    # Service worker (capture, AI, badge, context menu)
│   └── content.ts       # OG/meta data extraction from pages
├── components/          # Shared SolidJS components
├── lib/
│   ├── types.ts         # Data model types
│   ├── db.ts            # IndexedDB wrapper
│   ├── settings.ts      # chrome.storage.local settings
│   ├── ai.ts            # OpenRouter integration
│   ├── messages.ts      # Typed message passing
│   ├── duplicates.ts    # URL normalization and dedup
│   ├── sync.ts          # Cloudflare sync client
│   └── export.ts        # JSON + HTML bookmarks export/import
├── sync-service/        # Cloudflare Workers sync backend
├── tests/               # Vitest tests
└── assets/              # Global CSS with design system tokens
```

## Configuration

After loading the extension, click the gear icon to open Settings:

| Setting | Description |
|---------|-------------|
| **Browser / Profile Name** | Labels your captures (e.g., "Chrome - Work") |
| **OpenRouter API Key** | Your API key for AI-powered grouping and search |
| **AI Model** | Which model to use (default: GPT-4o-mini) |
| **Sync** | Enable cross-browser sync (requires deployed sync service) |

### Without an API Key

The extension works fully without an OpenRouter key. Tabs will be grouped by domain instead of AI-generated categories.

## Sync Service (Cloudflare)

The sync service lets you access your tab collection across multiple browsers and profiles.

### Automated Setup

```bash
# Login to Cloudflare first (one time)
cd sync-service && wrangler login

# Then run the automated setup
bun run sync:setup
```

This will:
1. Create a D1 database
2. Create a KV namespace
3. Update `wrangler.toml` with the resource IDs
4. Deploy the Worker
5. Run the database migration
6. Print the sync URL

### Manual Setup

```bash
# Create resources
bun run sync:db:create
bun run sync:kv:create

# Update sync-service/wrangler.toml with the IDs from above

# Deploy
bun run sync:deploy

# Run migration
bun run sync:db:migrate
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run sync:setup` | Full automated setup + deploy |
| `bun run sync:dev` | Run sync service locally |
| `bun run sync:deploy` | Deploy to Cloudflare |
| `bun run sync:db:create` | Create D1 database |
| `bun run sync:kv:create` | Create KV namespace |
| `bun run sync:db:migrate` | Run schema on remote D1 |

### Connecting Browsers

1. Deploy the sync service and copy the Worker URL
2. In Tab Zen Settings, paste the URL under **Sync URL**
3. Click **Enable Sync** -- a token is generated
4. Copy the token and paste it into Tab Zen on other browsers

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+Z` | Toggle side panel |
| `Cmd+Shift+S` | Capture all open tabs |

Shortcuts can be customized at `chrome://extensions/shortcuts`.

## Filter Views

| View | Description |
|------|-------------|
| **All** | All non-archived tabs grouped by AI/domain |
| **Starred** | Only starred tabs |
| **Notes** | Dedicated note-first layout showing all annotated tabs |
| **By Date** | Tabs grouped by capture date (Today, Yesterday, etc.) |
| **Archived** | Hidden tabs you've archived |

## License

MIT
