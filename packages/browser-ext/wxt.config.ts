// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import { allDomains } from './src/submitters/domains';

const buildHostPermissions = (): string[] => {
  const patterns = new Set<string>(['*://localhost/*']);
  for (const domain of allDomains) patterns.add(`*://${domain}/*`);
  return [...patterns].sort();
};

export default defineConfig({
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',
  outDir: 'dist',
  imports: false,
  webExt: { disabled: true },
  modules: ['@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: resolve(__dirname, '../core/res/cph-ng.png'),
  },
  zip: {
    name: 'cph-ng-submit',
  },
  manifest: ({ browser }) => {
    const hostPermissions = buildHostPermissions();
    const permissions = ['activeTab', 'storage', 'scripting', 'notifications'];
    if (browser === 'chrome') permissions.push('offscreen');

    return {
      name: '__MSG_appName__',
      description: '__MSG_appDescription__',
      permissions,
      host_permissions: hostPermissions,
      default_locale: 'en',
      web_accessible_resources: [
        {
          resources: ['/icons/128.png'],
          matches: ['<all_urls>'],
        },
        {
          resources: ['/assets/*'],
          matches: ['<all_urls>'],
        },
      ],
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'cph-ng-submit@langningchen.com',
                strict_min_version: '109.0',
                data_collection_permissions: {
                  required: ['none'],
                },
              },
            },
          }
        : {}),
    };
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      if (manifest.content_scripts) {
        for (const cs of manifest.content_scripts) {
          cs.matches = buildHostPermissions();
        }
      }
    },
    'build:publicAssets': async (_wxt, files) => {
      files.push({
        absoluteSrc: resolve('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs'),
        relativeDest: `assets/onnx-wasm/ort-wasm-simd-threaded.mjs`,
      });
      files.push({
        absoluteSrc: resolve('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'),
        relativeDest: `assets/onnx-wasm/ort-wasm-simd-threaded.wasm`,
      });
    },
    'prepare:publicPaths': (_wxt, paths) => {
      paths.push('assets/onnx-wasm/ort-wasm-simd-threaded.mjs');
      paths.push('assets/onnx-wasm/ort-wasm-simd-threaded.wasm');
    },
  },
  vite: () => ({
    resolve: {
      alias: {
        '@b': resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          warn(warning);
        },
      },
    },
  }),
});
