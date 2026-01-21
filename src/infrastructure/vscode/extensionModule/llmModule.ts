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
import type { ExtensionContext } from 'vscode';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class LlmModule implements IExtensionModule {
  public constructor(@inject(TOKENS.logger) private readonly logger: ILogger) {
    this.logger = this.logger.withScope('LlmModule');
  }

  public setup(_context: ExtensionContext): void {
    // TO-DO
    this.logger.info('Registering VS Code Language Model Tools');

    // const registrations = [
    //   lm.registerTool('run_test_cases', this.tcRunner),
    //   lm.registerTool('inspect_problem_data', this.dataInspector),
    //   lm.registerTool('list_test_cases', this.tcLister),
    //   lm.registerTool('upsert_test_case', this.tcEditor),
    // ];

    // context.subscriptions.push(...registrations);
  }
}
