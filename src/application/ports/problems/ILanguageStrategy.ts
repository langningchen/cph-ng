import type { FileWithHash, ICompilationSettings } from '@/types';

export interface CompileAdditionalData {
  canUseWrapper: boolean;
  compilationSettings?: ICompilationSettings;
  debug?: boolean;
}

export interface LangCompileResult {
  outputPath?: string;
  hash?: string;
  msg?: string;
}

export interface ILanguageStrategy {
  readonly name: string;
  readonly extensions: string[];
  readonly enableRunner: boolean;

  compile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    additionalData?: CompileAdditionalData,
  ): Promise<LangCompileResult>;

  getRunCommand(
    target: string,
    compilationSettings?: ICompilationSettings,
  ): Promise<string[]>;
}
