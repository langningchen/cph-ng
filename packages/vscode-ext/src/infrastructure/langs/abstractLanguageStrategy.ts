import type { ILanguageEnv, ToolchainItem } from '@cph-ng/core';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { KernelConfiguration } from '@/infrastructure/rpc/configuration';

/** UI language metadata and RPC delegation. Executable discovery runs in Rust. */
export abstract class AbstractLanguageStrategy implements ILanguageStrategy {
  public abstract readonly name: string;
  public abstract readonly extensions: string[];
  public constructor(protected readonly configuration: KernelConfiguration) {}
  public get defaultValues(): ILanguageEnv {
    return this.configuration.language(this.name);
  }
  public async checkCompiler(path: string): Promise<ToolchainItem | null> {
    return this.configuration.check(this.name, 'compiler', path);
  }
  public async checkInterpreter(path: string): Promise<ToolchainItem | null> {
    return this.configuration.check(this.name, 'interpreter', path);
  }
  public async getCompilers(): Promise<ToolchainItem[]> {
    return (await this.configuration.detect(this.name)).filter((item) => item.kind === 'compiler');
  }
  public async getInterpreters(): Promise<ToolchainItem[]> {
    return (await this.configuration.detect(this.name)).filter(
      (item) => item.kind === 'interpreter',
    );
  }
}
