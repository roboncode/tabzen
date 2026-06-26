export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  CONTENT: R2Bucket;
  // AI proxy secrets (wrangler secret put / .dev.vars). Kept server-side so
  // they're never shipped in the extension bundle.
  OPENROUTER_API_KEY: string;
  OPENAI_API_KEY: string;
};
