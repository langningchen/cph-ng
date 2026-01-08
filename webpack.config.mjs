// @ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

import { execSync } from 'child_process';
import CopyPlugin from 'copy-webpack-plugin';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { fileURLToPath } from 'url';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generateSettings = () => {
  const pkgPath = resolve(__dirname, 'package.json');

  return {
    /**
     * @param {import('webpack').Compiler} compiler
     */
    apply: (compiler) => {
      const runScript = () => {
        try {
          execSync('node scripts/generate-settings.js', { stdio: 'inherit' });
        } catch (error) {
          console.error('Failed to generate settings:', error);
        }
      };
      compiler.hooks.beforeRun.tap('Generate Settings Plugin', () => {
        runScript();
      });
      compiler.hooks.watchRun.tap('Generate Settings Plugin', (compiler) => {
        const modifiedFiles = compiler.modifiedFiles;
        if (!modifiedFiles || modifiedFiles.has(pkgPath)) {
          runScript();
        }
      });
      compiler.hooks.afterCompile.tap(
        'Generate Settings Plugin',
        (compilation) => {
          compilation.fileDependencies.add(pkgPath);
        },
      );
    },
  };
};
const generateBuildInfo = () => {
  return {
    /**
     * @param {import('webpack').Compiler} compiler
     */
    apply: (compiler) => {
      compiler.hooks.afterEmit.tap('Build Info Plugin', () => {
        try {
          const jsonPath = join(__dirname, 'dist', 'generated.json');
          mkdirSync(dirname(jsonPath), { recursive: true });
          let commitHash = 'unknown',
            userName = 'unknown';
          try {
            commitHash = execSync('git rev-parse HEAD').toString().trim();
            userName = execSync('git config user.name').toString().trim();
          } catch (e) {}
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

/**
 * @param {any} _env
 * @param {any} argv
 * @returns {WebpackConfig[]}
 */
export default (_env, argv) => {
  const isProd = argv.mode === 'production';

  const wsDefinePlugin = new webpack.DefinePlugin({
    'process.env.WS_NO_BUFFER_UTIL': JSON.stringify(true),
    'process.env.WS_NO_UTF_8_VALIDATE': JSON.stringify(true),
  });

  /** @type WebpackConfig */
  const baseConfig = {
    mode: isProd ? 'production' : 'development',
    devtool: 'source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
      alias: {
        '@': resolve(__dirname, 'src'),
        '@w': resolve(__dirname, 'src/webview/src'),
        bufferutil: false,
        'utf-8-validate': false,
      },
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
  };

  /** @type WebpackConfig */
  const extensionConfig = {
    ...baseConfig,
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
      generateSettings(),
      generateBuildInfo(),
      wsDefinePlugin,
      new CopyPlugin({
        patterns: [
          { from: 'testlib/testlib.h', to: 'testlib/testlib.h' },
          {
            from: 'testlib/checkers/*.cpp',
            to: 'testlib/[name].cpp',
          },
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

  /** @type WebpackConfig */
  const webviewConfig = {
    ...baseConfig,
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

  /** @type WebpackConfig */
  const routerConfig = {
    ...baseConfig,
    target: 'node',
    entry: './src/router/index.ts',
    output: {
      path: resolve(__dirname, 'dist'),
      filename: 'router.js',
      clean: false,
      library: {
        type: 'module',
      },
      chunkFormat: 'module',
    },
    experiments: { outputModule: true },
    plugins: [wsDefinePlugin],
    cache: {
      type: 'filesystem',
      buildDependencies: { config: [__filename] },
      name: isProd ? 'prod-router' : 'dev-router',
    },
  };

  return [extensionConfig, webviewConfig, routerConfig];
};
