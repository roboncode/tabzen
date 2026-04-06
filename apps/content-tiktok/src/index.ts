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
console.log("  TikTok Scraper API v1.0.0");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Server:      http://localhost:${port}`);
console.log(`  Docs:        http://localhost:${port}/docs`);
console.log(`  OpenAPI:     http://localhost:${port}/openapi`);
console.log(`  Data Source: ${env.SCRAPER_API_KEY ? "ScraperAPI (Enhanced Mode)" : "No API Key Configured"}`);
console.log("───────────────────────────────────────────────────────────");
console.log("  Features:");
console.log(`    ${env.SCRAPER_API_KEY ? "✓" : "○"} Profile information${env.SCRAPER_API_KEY ? "" : " (requires API key)"}`);
console.log(`    ${env.SCRAPER_API_KEY ? "✓" : "○"} Videos with pagination${env.SCRAPER_API_KEY ? "" : " (requires API key)"}`);
console.log(`    ${env.SCRAPER_API_KEY ? "✓" : "○"} Video transcripts${env.SCRAPER_API_KEY ? "" : " (requires API key)"}`);
console.log(`    ✓ Interactive API documentation with Scalar`);
console.log("═══════════════════════════════════════════════════════════");
if (!env.SCRAPER_API_KEY) {
  console.log("  ⚠️  No API Key Configured");
  console.log("  💡 Add SCRAPER_API_KEY to .env for all features:");
  console.log("     - Profile information");
  console.log("     - Video fetching with pagination");
  console.log("     - Video details and metadata");
  console.log("     - Video transcripts");
  console.log("═══════════════════════════════════════════════════════════");
}
