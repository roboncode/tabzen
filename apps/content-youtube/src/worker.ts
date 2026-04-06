/**
 * Cloudflare Workers entry point for YouTube Scraper API
 * This file exports the Hono app for Cloudflare Workers deployment
 */

import { createApp } from "./app";

// Define Cloudflare Workers environment bindings
export interface Env {
  // Port (not used in Workers, but kept for compatibility)
  PORT?: string;

  // YouTube API configuration
  YOUTUBE_API_KEY?: string;

  // Server URL for OpenAPI documentation
  SERVER_URL?: string;
}

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create environment object compatible with our app
    const appEnv = {
      PORT: env.PORT || "8787",
      YOUTUBE_API_KEY: env.YOUTUBE_API_KEY,
      SERVER_URL: env.SERVER_URL,
    };

    // Create and return the app
    const app = createApp(appEnv);
    return app.fetch(request, env);
  },
};
