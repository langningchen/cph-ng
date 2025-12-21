import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    alias: {
        '@': resolve(__dirname, 'src'),
        '@w': resolve(__dirname, 'src/webview/src'),
    },
  },
});
