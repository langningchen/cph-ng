import { transform } from '@swc/core';
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  plugins: [{
    name: 'typescript-legacy-decorators',
    enforce: 'pre',
    async transform(code, id) {
      if (!/\.tsx?$/.test(id) || id.includes('/node_modules/')) return;
      return transform(code, {
        filename: id,
        jsc: { target: 'es2022', parser: { syntax: 'typescript', tsx: id.endsWith('.tsx'), decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } },
        module: { type: 'es6' }, sourceMaps: true,
      });
    },
  }],
  test: {
    clearMocks: true,
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    retry: 3,
    alias: {
      '@/': resolve(__dirname, 'src') + '/',
      '@t/': resolve(__dirname, 'tests') + '/'
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'], 
      exclude: ['src/extension.ts', 'src/application/ports/**']
    },
  },
});
