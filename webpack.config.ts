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

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import CopyPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import type { Compiler, Configuration } from 'webpack';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const generateSchema = () => {
  const typesPath = resolve(__dirname, 'src/domain/types.ts');
  const outputPath = resolve(__dirname, 'dist/problem.schema.json');

  return {
    apply: (compiler: Compiler) => {
      const runCommand = () => {
        try {
          mkdirSync(dirname(outputPath), { recursive: true });
          execSync(
            `pnpm exec ts-json-schema-generator --path 'src/domain/types.ts' --type 'IProblem' -o ${outputPath}`,
            { stdio: 'inherit' },
          );
          console.log('Successfully generated schema file.');
        } catch (error) {
          console.error('Failed to generate schema:', error);
        }
      };

      compiler.hooks.beforeRun.tap('Generate Schema Plugin', () => {
        runCommand();
      });

      compiler.hooks.watchRun.tap('Generate Schema Plugin', (compiler) => {
        const modifiedFiles = compiler.modifiedFiles;
        if (!modifiedFiles || modifiedFiles.has(typesPath)) {
          runCommand();
        }
      });

      compiler.hooks.afterCompile.tap('Generate Schema Plugin', (compilation) => {
        compilation.fileDependencies.add(typesPath);
      });
    },
  };
};

const generateSettings = () => {
  const pkgPath = resolve(__dirname, 'package.json');

  return {
    apply: (compiler: Compiler) => {
      const generate = () => {
        execSync('pnpm run generate-settings', { stdio: 'inherit' });
      };
      compiler.hooks.beforeRun.tap('Generate Settings Plugin', generate);
      compiler.hooks.watchRun.tap('Generate Settings Plugin', (compiler) => {
        if (compiler.modifiedFiles?.has(pkgPath)) generate();
      });
      compiler.hooks.afterCompile.tap('Generate Settings Plugin', (compilation) => {
        compilation.fileDependencies.add(pkgPath);
      });
    },
  };
};
const generateBuildInfo = () => {
  return {
    apply: (compiler: Compiler) => {
      compiler.hooks.afterEmit.tap('Build Info Plugin', () => {
        try {
          const jsonPath = join(__dirname, 'dist', 'generated.json');
          mkdirSync(dirname(jsonPath), { recursive: true });
          let commitHash = 'unknown',
            userName = 'unknown';
          try {
            commitHash = execSync('git rev-parse HEAD').toString().trim();
            userName = execSync('git config user.name').toString().trim();
          } catch (_e) {}
          writeFileSync(
            jsonPath,
            JSON.stringify(
              {
                commitHash,
                buildTime: new Date().toISOString(),
                buildBy: userName,
                buildType: process.env.BUILD_TYPE || 'Manual',
              },
              null,
              2,
            ),
          );
        } catch (error) {
          console.error('Failed to write build info:', error);
        }
      });
    },
  };
};

/* biome-ignore lint/style/noDefaultExport: Webpack config requires default export */
export default (_env: Record<string, unknown>, argv: Record<string, unknown>): Configuration[] => {
  const isProd = argv.mode === 'production';

  const makeBaseConfig = (): Configuration => ({
    mode: isProd ? 'production' : 'development',
    devtool: 'source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
      plugins: [
        new TsconfigPathsPlugin({
          configFile: resolve(__dirname, 'tsconfig.json'),
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
      hints: false,
      maxEntrypointSize: 2 * 1024 * 1024,
      maxAssetSize: 2 * 1024 * 1024,
    },
    ignoreWarnings: [
      {
        module: /node_modules\/hono\/dist\/utils\/color\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ],
  });

  const extensionConfig: Configuration = {
    ...makeBaseConfig(),
    target: 'node',
    entry: './src/extension.ts',
    output: {
      path: resolve(__dirname, 'dist'),
      filename: 'extension.js',
      library: {
        type: 'module',
      },
      chunkFormat: 'module',
    },
    externals: { vscode: 'vscode' },
    plugins: [
      generateSchema(),
      generateSettings(),
      generateBuildInfo(),
      new CopyPlugin({
        patterns: [
          { from: 'testlib/testlib.h', to: 'testlib/testlib.h' },
          { from: 'testlib/checkers/*.cpp', to: 'testlib/[name].cpp' },
          { from: 'res/compare.cpp', to: 'testlib/compare.cpp' },
        ],
      }),
    ],
    experiments: { outputModule: true },
    cache: {
      type: 'filesystem',
      buildDependencies: { config: [__filename] },
      name: isProd ? 'prod-ext' : 'dev-ext',
    },
  };

  const webviewConfig: Configuration = {
    ...makeBaseConfig(),
    target: 'web',
    entry: './src/webview/src/App.tsx',
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
        patterns: [{ from: 'src/webview/src/styles.css', to: 'styles.css' }],
      }),
    ],
    cache: {
      type: 'filesystem',
      buildDependencies: { config: [__filename] },
      name: isProd ? 'prod-web' : 'dev-web',
    },
  };

  const routerConfig: Configuration = {
    ...makeBaseConfig(),
    target: 'node20',
    entry: './src/router/index.ts',
    output: {
      path: resolve(__dirname, 'dist'),
      filename: 'router.cjs',
      library: {
        type: 'commonjs2',
      },
    },
    cache: {
      type: 'filesystem',
      buildDependencies: { config: [__filename] },
      name: isProd ? 'prod-router' : 'dev-router',
    },
    externalsPresets: { node: true },
    plugins: [
      new webpack.IgnorePlugin({
        resourceRegExp: /^(bufferutil|utf-8-validate)$/,
      }),
    ],
  };

  return [extensionConfig, webviewConfig, routerConfig];
};
