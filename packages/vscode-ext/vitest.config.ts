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
      '@/': resolve(import.meta.dirname, 'src') + '/',
      '@t/': resolve(import.meta.dirname, 'tests') + '/'
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'], 
      exclude: ['src/extension.ts', 'src/application/ports/**']
    },
  },
});
