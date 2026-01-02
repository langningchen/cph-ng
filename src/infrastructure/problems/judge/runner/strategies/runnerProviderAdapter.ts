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

import { inject, injectable } from 'tsyringe';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { IRunnerProvider } from '@/application/ports/problems/judge/runner/execution/strategies/IRunnerProvider';
import type { IPathRenderer } from '@/application/ports/services/IPathRenderer';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class RunnerProviderAdapter implements IRunnerProvider {
  private cachedPath: string | null = null;
  private compilationPromise: Promise<string> | null = null;

  constructor(
    @inject(TOKENS.ExtensionPath) private readonly path: string,
    @inject(TOKENS.FileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.System) private readonly sys: ISystem,
    @inject(TOKENS.ProcessExecutor) private readonly executor: IProcessExecutor,
    @inject(TOKENS.Settings) private readonly settings: ISettings,
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.PathRenderer) private readonly renderer: IPathRenderer,
  ) {
    this.logger = this.logger.withScope('RunnerProvider');
  }

  public async getRunnerPath(signal: AbortSignal): Promise<string> {
    if (this.cachedPath) return this.cachedPath;
    if (this.compilationPromise) return this.compilationPromise;
    this.compilationPromise = this.resolveOrCompile(signal);
    try {
      this.cachedPath = await this.compilationPromise;
      return this.cachedPath;
    } finally {
      this.compilationPromise = null;
    }
  }

  private async resolveOrCompile(signal: AbortSignal): Promise<string> {
    const isWin = this.sys.type() === 'Windows_NT';

    const srcPath = this.fs.join(
      this.path,
      'res',
      isWin ? 'runner-windows.cpp' : 'runner-linux.cpp',
    );
    const binaryName = isWin ? 'runner-windows.exe' : 'runner-linux';
    const outputPath = this.fs.join(
      this.renderer.renderPath(this.settings.cache.directory),
      binaryName,
    );

    if (await this.fs.exists(outputPath)) {
      this.logger.debug('Using existing runner binary', { outputPath });
      return outputPath;
    }
    this.logger.info('Compiling runner utility...', { srcPath, outputPath });

    const compiler = this.settings.compilation.cppCompiler;
    const flags = isWin ? ['-lpsapi', '-ladvapi32', '-static'] : ['-pthread'];
    const cmd = [compiler, srcPath, '-o', outputPath, ...flags, '-O3'];
    const result = await this.executor.execute({ cmd, signal });

    if (result instanceof Error) {
      this.logger.error('Failed to compile runner', result);
      throw new Error(`Failed to compile runner utility: ${result.message}`);
    }

    if (result.codeOrSignal !== 0) {
      const stderr = await this.fs.readFile(result.stderrPath);
      this.logger.error('Runner compilation failed', { stderr });
      throw new Error(`Runner compilation failed with code ${result.codeOrSignal}`);
    }

    if (!(await this.fs.exists(outputPath))) {
      throw new Error('Compiler exited successfully but output file is missing');
    }

    return outputPath;
  }
}
