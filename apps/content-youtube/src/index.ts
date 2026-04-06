import { createServer } from "node:http";
import { env } from "./env";
import { createApp } from "./app";

// Create the app with environment configuration
const app = createApp(env);

const port = parseInt(env.PORT);

createServer(async (req, res) => {
  const url = `http://${req.headers.host}${req.url}`;
  const method = req.method || "GET";

  // Convert Node.js request to Web API Request
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  let body: any = null;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }

  const request = new Request(url, {
    method,
    headers,
    body,
  });

  const response = await app.fetch(request);

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(port);

// Startup logs
console.log("═══════════════════════════════════════════════════════════");
console.log("  YouTube Scraper API v1.0.0");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Server:      http://localhost:${port}`);
console.log(`  Docs:        http://localhost:${port}/docs`);
console.log(`  OpenAPI:     http://localhost:${port}/openapi`);
console.log(`  Data Source: ${env.YOUTUBE_API_KEY ? "YouTube Data API (Enhanced Mode)" : "RSS Feed (Free Mode)"}`);
console.log("───────────────────────────────────────────────────────────");
console.log("  Features:");
console.log(`    ✓ Channel information and handle resolution`);
console.log(`    ✓ Recent videos (RSS feed, no API key required)`);
console.log(`    ${env.YOUTUBE_API_KEY ? "✓" : "○"} Paginated videos with filtering${env.YOUTUBE_API_KEY ? "" : " (requires API key)"}`);
console.log(`    ✓ Video transcripts`);
console.log(`    ✓ Interactive API documentation with Scalar`);
console.log("═══════════════════════════════════════════════════════════");
if (!env.YOUTUBE_API_KEY) {
  console.log("  ⚠️  Running in Free Mode");
  console.log("  💡 Add YOUTUBE_API_KEY to .env for enhanced features:");
  console.log("     - Paginated video listings");
  console.log("     - Advanced date filtering");
  console.log("     - Video duration information");
  console.log("     - Higher rate limits");
  console.log("═══════════════════════════════════════════════════════════");
}
