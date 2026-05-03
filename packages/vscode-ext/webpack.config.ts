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

import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import CopyPlugin from 'copy-webpack-plugin';
import type { Compiler, Configuration } from 'webpack';
import webpack from 'webpack';
import { makeBaseConfig } from '../../webpack.base.ts';

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
          execFileSync(
            'pnpm',
            [
              'exec',
              'ts-json-schema-generator',
              '--no-type-check',
              '--path',
              resolve(__dirname, '../core/src/index.ts'),
              '--type',
              'IProblem',
              '--tsconfig',
              resolve(__dirname, 'tsconfig.schema.json'),
              '-o',
              outputPath,
            ],
            { stdio: 'inherit', cwd: __dirname },
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
        execSync('pnpm generate-settings', { stdio: 'inherit', cwd: __dirname });
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

export default (_env: Record<string, unknown>, argv: Record<string, unknown>): Configuration[] => {
  const isProd = argv.mode === 'production';
  const base = makeBaseConfig(isProd, resolve(__dirname, 'tsconfig.json'));

  const extensionConfig: Configuration = {
    ...base,
    target: 'node',
    entry: './src/extension.ts',
    output: {
      path: resolve(__dirname, 'dist'),
      filename: 'extension.js',
      library: { type: 'module' },
      chunkFormat: 'module',
      devtoolModuleFilenameTemplate: ({ absoluteResourcePath }) => absoluteResourcePath,
    },
    externals: { vscode: 'vscode' },
    plugins: [
      generateSchema(),
      generateSettings(),
      generateBuildInfo(),
      new CopyPlugin({
        patterns: [
          { from: resolve(__dirname, '../../testlib/testlib.h'), to: 'testlib/testlib.h' },
          { from: resolve(__dirname, '../../testlib/checkers/*.cpp'), to: 'testlib/[name].cpp' },
          { from: resolve(__dirname, 'res/compare.cpp'), to: 'testlib/compare.cpp' },
        ],
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /^(bufferutil|utf-8-validate)$/,
      }),
    ],
    experiments: { outputModule: true },
    cache: {
      type: 'filesystem',
      buildDependencies: { config: [__filename] },
      name: isProd ? 'prod-extension' : 'dev-extension',
    },
  };

  if (!isProd)
    extensionConfig.plugins?.push(
      new CopyPlugin({
        patterns: [
          { from: resolve(__dirname, '../vscode-webview/dist'), force: true },
          { from: resolve(__dirname, '../vscode-router/dist'), force: true },
        ],
      }),
    );

  return [extensionConfig];
};
