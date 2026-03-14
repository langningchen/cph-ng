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

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import CopyPlugin from 'copy-webpack-plugin';
import type { Configuration } from 'webpack';
import { makeBaseConfig } from '../../webpack.base.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default (_env: Record<string, unknown>, argv: Record<string, unknown>): Configuration[] => {
  const isProd = argv.mode === 'production';
  const base = makeBaseConfig(isProd, resolve(__dirname, 'tsconfig.json'));

  const webviewConfig: Configuration = {
    ...base,
    target: 'web',
    entry: './src/App.tsx',
    devtool: isProd ? 'source-map' : 'inline-source-map',
    output: {
      path: resolve(__dirname, 'dist'),
      filename: 'frontend.js',
      devtoolModuleFilenameTemplate: (info) => {
        return `file://${resolve(info.absoluteResourcePath).replace(/\\/g, '/')}`;
      },
    },
    plugins: [
      new CopyPlugin({
        patterns: [{ from: resolve(__dirname, 'src/styles.css'), to: 'styles.css' }],
      }),
    ],
    cache: {
      type: 'filesystem',
      buildDependencies: { config: [__filename] },
      name: isProd ? 'prod-webview' : 'dev-webview',
    },
  };

  return [webviewConfig];
};
