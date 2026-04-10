/**
 * Test script for iterating on AI prompts locally.
 *
 * Usage:
 *   pnpm tsx scripts/test-prompt.ts [prompt-name] [--transcript path/to/file.txt]
 *
 * Examples:
 *   pnpm tsx scripts/test-prompt.ts key-points
 *   pnpm tsx scripts/test-prompt.ts key-points --transcript tmp/sample-transcript.txt
 *   pnpm tsx scripts/test-prompt.ts summary
 *
 * Defaults:
 *   - prompt: key-points
 *   - transcript: tmp/sample-transcript.txt
 *   - model: openai/gpt-4o-mini (override with MODEL env var)
 *
 * Reads VITE_OPENROUTER_API_KEY from apps/extension/.env.local
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv(): string {
  const envPath = resolve(ROOT, "apps/extension/.env.local");
  const content = readFileSync(envPath, "utf-8");
  const match = content.match(/VITE_OPENROUTER_API_KEY=(.+)/);
  if (!match) throw new Error("VITE_OPENROUTER_API_KEY not found in .env.local");
  return match[1].trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  let promptName = "key-points";
  let transcriptPath = resolve(ROOT, "tmp/sample-transcript.txt");
  let contentType: "transcript" | "markdown" = "transcript";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--transcript" && args[i + 1]) {
      transcriptPath = resolve(args[++i]);
    } else if (args[i] === "--content-type" && args[i + 1]) {
      contentType = args[++i] as "transcript" | "markdown";
    } else if (!args[i].startsWith("--")) {
      promptName = args[i];
    }
  }

  return { promptName, transcriptPath, contentType };
}

async function callOpenRouter(apiKey: string, model: string, prompt: string, content: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "chrome-extension://tab-zen",
      "X-Title": "Tab Zen - Prompt Test",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function main() {
  const { promptName, transcriptPath, contentType } = parseArgs();
  const apiKey = loadEnv();
  const model = process.env.MODEL || "openai/gpt-4o-mini";

  // Load prompt
  const promptPath = resolve(ROOT, `apps/extension/prompts/${promptName}.md`);
  let prompt: string;
  try {
    prompt = readFileSync(promptPath, "utf-8");
  } catch {
    console.error(`Prompt not found: ${promptPath}`);
    console.error(`Available prompts:`);
    const { readdirSync } = await import("fs");
    readdirSync(resolve(ROOT, "apps/extension/prompts"))
      .filter((f) => f.endsWith(".md"))
      .forEach((f) => console.error(`  - ${f.replace(".md", "")}`));
    process.exit(1);
  }

  // Replace template vars
  const contentLabel = contentType === "transcript" ? "video transcript" : "article";
  prompt = prompt.replace(/\{\{contentType\}\}/g, contentLabel);

  // Load content
  let content: string;
  try {
    content = readFileSync(transcriptPath, "utf-8");
  } catch {
    console.error(`Content file not found: ${transcriptPath}`);
    console.error(`Create it with: echo "your content" > ${transcriptPath}`);
    process.exit(1);
  }

  console.log(`--- Config ---`);
  console.log(`Prompt:  ${promptName}`);
  console.log(`Model:   ${model}`);
  console.log(`Content: ${transcriptPath} (${content.length} chars)`);
  console.log(`Type:    ${contentType}`);
  console.log(`\n--- Prompt ---`);
  console.log(prompt);
  console.log(`\n--- Calling OpenRouter... ---\n`);

  const result = await callOpenRouter(apiKey, model, prompt, content);

  console.log(`--- Result ---`);
  console.log(result);

  // Parse and show structured output for key-points
  if (promptName === "key-points") {
    console.log(`\n--- Parsed Key Points ---`);
    const lines = result
      .split("\n")
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter((l) => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
      const pipeIndex = lines[i].indexOf("|");
      if (pipeIndex !== -1) {
        const title = lines[i].slice(0, pipeIndex).trim();
        const desc = lines[i].slice(pipeIndex + 1).trim();
        console.log(`\n  [${i + 1}] ${title}`);
        console.log(`      ${desc}`);
      } else {
        console.log(`\n  [${i + 1}] (no title) ${lines[i]}`);
      }
    }
  }
}

main().catch(console.error);
