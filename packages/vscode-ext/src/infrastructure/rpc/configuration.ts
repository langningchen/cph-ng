// biome-ignore-all lint/style/useNamingConvention: Configuration fields follow the Rust wire schema.
import type { ILanguageEnv, ToolchainItem } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import { workspace } from 'vscode';
import { quoteArgument, splitArguments } from './arguments';
import { KernelService } from './kernelService';

export { missingValues, quoteArgument } from './arguments';

import { rpcMethod } from './protocol';

export interface KernelConfig {
  compilation_timeout_ms?: number;
  problem: { time_limit: number; memory_limit: number };
  languages: Record<
    string,
    {
      compiler?: string;
      compiler_args?: string[];
      interpreter?: string;
      interpreter_args?: string[];
    }
  >;
  judge?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface ConfigSnapshot {
  path: string;
  sources: string[];
  config: KernelConfig;
  local_config: Record<string, unknown>;
  toml: string;
  raw_toml: string;
}
export interface DetectedToolchain extends ToolchainItem {
  language: string;
  kind: 'compiler' | 'interpreter';
}
export const languageIds: Record<string, string> = {
  C: 'c',
  'C++': 'cpp',
  Rust: 'rust',
  Java: 'java',
  Python: 'python',
  JavaScript: 'javascript',
};

/** A view of Rust-owned settings. This adapter never reads VS Code kernel settings during runs. */
@injectable()
export class KernelConfiguration {
  public current?: ConfigSnapshot;
  public constructor(@inject(KernelService) public readonly kernel: KernelService) {}

  public async get(source?: string): Promise<ConfigSnapshot> {
    const client = source
      ? await this.kernel.forSource(source)
      : await this.kernel.forConfiguration();
    const value = await client.request<ConfigSnapshot>(
      rpcMethod.configGet,
      source ? { source_path: source } : {},
    );
    if (!source) this.current = value;
    return value;
  }
  public async set(
    change: { patch?: Record<string, unknown>; toml?: string; expected_raw_toml?: string },
    source?: string,
  ): Promise<ConfigSnapshot> {
    const client = source
      ? await this.kernel.forSource(source)
      : await this.kernel.forConfiguration();
    const value = await client.request<ConfigSnapshot>(rpcMethod.configSet, {
      ...change,
      ...(source ? { source_path: source } : {}),
    });
    if (!source) this.current = value;
    return value;
  }
  public language(name: string): ILanguageEnv {
    const value = this.current?.config.languages[languageIds[name] ?? name];
    return {
      ...(value?.compiler !== undefined
        ? {
            compiler: value.compiler,
            compilerArgs: (value.compiler_args ?? []).map(quoteArgument).join(' '),
          }
        : {}),
      ...(value?.interpreter !== undefined
        ? {
            interpreter: value.interpreter,
            interpreterArgs: (value.interpreter_args ?? []).map(quoteArgument).join(' '),
          }
        : {}),
    };
  }
  public async updateLanguage(name: string, value: ILanguageEnv): Promise<void> {
    const language = languageIds[name] ?? name;
    const patch = {
      ...(value.compiler !== undefined
        ? { compiler: value.compiler, compiler_args: splitArguments(value.compilerArgs ?? '') }
        : {}),
      ...(value.interpreter !== undefined
        ? {
            interpreter: value.interpreter,
            interpreter_args: splitArguments(value.interpreterArgs ?? ''),
          }
        : {}),
    };
    await this.set({ patch: { languages: { [language]: patch } } });
  }
  public async detect(language?: string): Promise<DetectedToolchain[]> {
    const client = await this.kernel.forConfiguration();
    const result = await client.request<{ toolchains: DetectedToolchain[] }>(
      rpcMethod.toolchainDetect,
      language ? { language: languageIds[language] ?? language } : {},
    );
    return result.toolchains;
  }
  public async check(
    language: string,
    kind: 'compiler' | 'interpreter',
    path: string,
  ): Promise<DetectedToolchain | null> {
    const client = await this.kernel.forConfiguration();
    return client.request(rpcMethod.toolchainCheck, {
      language: languageIds[language] ?? language,
      kind,
      path,
    });
  }
  /** Only called by the explicit migration command; existing Rust values win. */
  public legacyPatch(): Record<string, unknown> {
    const settings = workspace.getConfiguration('cph-ng');
    const configured = <T>(key: string): T | undefined => {
      const value = settings.inspect<T>(key);
      return value?.workspaceFolderValue ?? value?.workspaceValue ?? value?.globalValue;
    };
    const patch: Record<string, unknown> = {};
    const timeout = configured<number>('run.compilationTimeout');
    if (timeout !== undefined) patch.compilation_timeout_ms = timeout;
    const problem: Record<string, number> = {};
    const time = configured<number>('problem.defaultTimeLimit');
    const memory = configured<number>('problem.defaultMemoryLimit');
    if (time !== undefined) problem.time_limit = time;
    if (memory !== undefined) problem.memory_limit = memory;
    if (Object.keys(problem).length) patch.problem = problem;
    const languages: Record<string, unknown> = {};
    for (const id of Object.values(languageIds)) {
      const value: Record<string, unknown> = {};
      for (const kind of ['compiler', 'interpreter']) {
        const key = kind[0].toUpperCase() + kind.slice(1);
        const executable = configured<string>(`languages.${id}${key}`);
        const args = configured<string>(`languages.${id}${key}Args`);
        if (executable !== undefined && executable !== '') value[kind] = executable;
        if (args !== undefined) value[`${kind}_args`] = splitArguments(args);
      }
      if (Object.keys(value).length) languages[id] = value;
    }
    if (Object.keys(languages).length) patch.languages = languages;
    const comparison: Record<string, unknown> = {};
    for (const [old, key] of [
      ['ignoreError', 'ignore_stderr'],
      ['regardPEAsAC', 'regard_pe_as_ac'],
      ['oleSize', 'output_ratio_limit'],
    ]) {
      const value = configured(`comparing.${old}`);
      if (value !== undefined) comparison[key] = value;
    }
    if (Object.keys(comparison).length)
      patch.judge = { checker_mode: 'legacy', legacy_comparison: comparison };
    return patch;
  }
}
