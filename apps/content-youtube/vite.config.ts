import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    outDir: "dist",
    lib: {
      entry: "./src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "hono",
        "axios",
        "cheerio",
        "zod",
        "@t3-oss/env-core",
        "xml2js",
        "youtube-transcript",
        "youtube-transcript-plus",
        /^node:.*/,
      ],
    },
    ssr: true,
    minify: false,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
