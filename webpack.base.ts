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

// biome-ignore-all lint/style/useNamingConvention: Terser API requires snake_case

import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import type { Configuration } from 'webpack';

export const makeBaseConfig = (isProd: boolean, tsconfigPath: string): Configuration => ({
  mode: isProd ? 'production' : 'development',
  devtool: 'source-map',
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: tsconfigPath,
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: true,
              },
              target: 'es2020',
              transform: { react: { runtime: 'automatic' } },
            },
          },
        },
      },
      {
        test: /\.svg$/i,
        type: 'asset/inline',
      },
    ],
  },
  optimization: {
    minimize: isProd,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        parallel: true,
        terserOptions: {
          format: { comments: false },
          compress: { drop_console: isProd, drop_debugger: true },
        },
      }),
    ],
  },
  performance: {
    maxEntrypointSize: 2 * 1024 * 1024,
    maxAssetSize: 2 * 1024 * 1024,
  },
});
