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
import { type ExtensionContext, lm } from 'vscode';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { LlmDataInspector } from '@/infrastructure/vscode/llmTools/llmDataInspector';
import { LlmProblemContext } from '@/infrastructure/vscode/llmTools/llmProblemContext';
import { LlmTestcaseRunner } from '@/infrastructure/vscode/llmTools/llmTcRunner';
import { LlmTestcaseEditor } from '@/infrastructure/vscode/llmTools/llmTestCaseEditor';

@injectable()
export class LlmModule implements IExtensionModule {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(LlmTestcaseRunner) private readonly tcRunner: LlmTestcaseRunner,
    @inject(LlmDataInspector) private readonly dataInspector: LlmDataInspector,
    @inject(LlmTestcaseEditor) private readonly tcEditor: LlmTestcaseEditor,
    @inject(LlmProblemContext) private readonly problemContext: LlmProblemContext,
  ) {
    this.logger = this.logger.withScope('llmModule');
  }

  public setup(context: ExtensionContext): void {
    this.logger.info('Registering VS Code Language Model Tools');

    const registrations = [
      lm.registerTool('cph-ng_run_test_cases', this.tcRunner),
      lm.registerTool('cph-ng_inspect_test_case', this.dataInspector),
      lm.registerTool('cph-ng_upsert_test_case', this.tcEditor),
      lm.registerTool('cph-ng_get_problem_context', this.problemContext),
    ];

    context.subscriptions.push(...registrations);
  }
}
