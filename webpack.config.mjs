// @ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

import { execSync } from 'child_process';
import CopyPlugin from 'copy-webpack-plugin';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
                        commitHash = execSync('git rev-parse HEAD')
                            .toString()
                            .trim();
                        userName = execSync('git config user.name')
                            .toString()
                            .trim();
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
 * @param {any} env
 * @param {any} argv
 * @returns {WebpackConfig[]}
 */
export default (env, argv) => {
    const isProd = argv.mode === 'production';

    /** @type WebpackConfig */
    const baseConfig = {
        mode: isProd ? 'production' : 'development',
        devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
        resolve: {
            extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
            alias: { '@': resolve(__dirname, 'src') },
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
            clean: { keep: /generated\.json/ },
        },
        externals: { vscode: 'vscode' },
        plugins: [
            generateBuildInfo(),
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
        output: {
            path: resolve(__dirname, 'dist'),
            filename: 'frontend.js',
        },
        plugins: [
            new CopyPlugin({
                patterns: [
                    { from: 'src/webview/src/styles.css', to: 'styles.css' },
                ],
            }),
        ],
        cache: {
            type: 'filesystem',
            buildDependencies: { config: [__filename] },
            name: isProd ? 'prod-web' : 'dev-web',
        },
    };

    return [extensionConfig, webviewConfig];
};
