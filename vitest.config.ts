import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    retry: 3,
    alias: {
      '@': resolve(__dirname, 'src'),
      '@t': resolve(__dirname, 'tests'),
      '@w': resolve(__dirname, 'src/webview/src'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'], 
      exclude: ['src/extension.ts', 'src/application/ports/**']
    },
  },
});
