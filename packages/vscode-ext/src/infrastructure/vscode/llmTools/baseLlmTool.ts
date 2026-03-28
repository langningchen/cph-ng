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

import type {
  CancellationToken,
  LanguageModelToolInvocationOptions,
  PreparedToolInvocation,
} from 'vscode';
import { LanguageModelTextPart, LanguageModelToolResult } from 'vscode';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { LlmTool } from '@/application/ports/vscode/ILlmTool';
import type { BackgroundProblem } from '@/domain/entities/backgroundProblem';

export interface BaseLlmToolParams {
  activePath?: string;
}

export abstract class BaseLlmTool<T extends BaseLlmToolParams> implements LlmTool<T> {
  protected constructor(
    protected readonly repo: IProblemRepository,
    protected readonly activePathService: IActivePathService,
  ) {}

  public abstract prepareInvocation(
    options: { input: T },
    token: CancellationToken,
  ): Promise<PreparedToolInvocation>;

  public abstract run(
    input: T,
    problem: BackgroundProblem,
    token: CancellationToken,
  ): Promise<LanguageModelToolResult>;

  public async invoke(
    options: LanguageModelToolInvocationOptions<T>,
    token: CancellationToken,
  ): Promise<LanguageModelToolResult> {
    try {
      const activePath = options.input.activePath ?? this.activePathService.getActivePath();
      if (!activePath)
        return this.createResult(
          'Error: No active file found. Please open a solution file or provide a path.',
        );
      const backgroundProblem = await this.repo.loadByPath(activePath);
      if (!backgroundProblem)
        return this.createResult(
          `Error: No competitive programming problem found for: ${activePath}`,
        );

      return await this.run(options.input, backgroundProblem, token);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return this.createResult(`Operation failed: ${msg}`);
    }
  }

  protected createResult(data: unknown): LanguageModelToolResult {
    if (typeof data === 'string')
      return new LanguageModelToolResult([new LanguageModelTextPart(data)]);
    return new LanguageModelToolResult([new LanguageModelTextPart(JSON.stringify(data))]);
  }
}
