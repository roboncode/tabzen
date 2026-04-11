import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  test: { globals: true, exclude: ['e2e/**', 'node_modules/**'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tab-zen/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@tab-zen/chat': path.resolve(__dirname, '../../packages/chat/src/index.ts'),
    },
  },
});
