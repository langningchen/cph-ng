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

import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import { allDomains } from './src/submitters/domains';

const buildHostPermissions = (): string[] => {
  const patterns = new Set<string>();
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
    return {
      name: '__MSG_appName__',
      description: '__MSG_appDescription__',
      permissions: ['activeTab', 'storage', 'scripting', 'notifications'],
      host_permissions: hostPermissions,
      default_locale: 'en',
      web_accessible_resources: [
        {
          resources: ['/icons/128.png'],
          matches: ['<all_urls>'],
        },
        {
          resources: ['assets/*'],
          matches: ['<all_urls>'],
        },
      ],
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'cph-ng-submit@langningchen.com',
                strict_min_version: '109.0',
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
    'build:publicAssets': async (wxt, files) => {
      const wasmDir = resolve(wxt.config.root, 'node_modules/onnxruntime-web/dist');
      const wasmFiles = await readdir(wasmDir);
      for (const file of wasmFiles)
        if (file.startsWith('ort-wasm-simd-threaded.'))
          files.push({
            absoluteSrc: resolve(wasmDir, file),
            relativeDest: `assets/onnx-wasm/${file}`,
          });
    },
  },
  vite: () => ({
    resolve: {
      alias: {
        '@cph-ng/core': resolve(__dirname, '../core/src'),
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
