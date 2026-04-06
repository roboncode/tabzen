import { config } from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Load .env file
config();

export const env = createEnv({
  server: {
    PORT: z.string().default("5151"),
    SCRAPER_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
