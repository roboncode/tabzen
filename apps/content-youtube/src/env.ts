import { config } from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Load .env file
config();

export const env = createEnv({
  server: {
    YOUTUBE_API_KEY: z.string().optional(),
    PORT: z.string().default("5150"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
